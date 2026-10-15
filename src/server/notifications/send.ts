import "server-only";
import { checkSchedule, notificationHref, notificationInput, pushPayload, type NotificationInput } from "@/lib/notifications";
import { audit } from "../audit";
import { db } from "../db";
import { audienceUserIds } from "./audience";
import { sendPushToUsers } from "./push";

/**
 * Admin bildirishnomalari: yaratish va yuborish. Chaqiruvchi `requireRole("ADMIN")` qilgan.
 * Yuborish atom: `SCHEDULED → SENDING` bitta UPDATE (ikki jarayon bir vaqtda ishlasa ham bir marta), qabul qiluvchilar
 * `UserNotification` ga (ilova ichi), keyin Web Push. "Ochildi" — `readAt` bor qatorlar (hisoblanadi, saqlanmaydi).
 */

/** SENDING holatida shuncha daqiqadan oshib qolgan xabar — jarayon yo'lda to'xtagan (FAILED). */
export const STUCK_MINUTES = 15;
const CHUNK = 1000;

export type CreateResult = { ok: true; id: string; immediate: boolean } | { ok: false; error: "invalid" | "past" | "far" | "audience_empty" };

export async function createNotification(raw: unknown, actorId: string, now = new Date()): Promise<CreateResult> {
  const parsed = notificationInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "audience_empty") ? "audience_empty" : "invalid" };
  const input: NotificationInput = parsed.data;
  // Biznes egalariga faqat "asosiy sahifa" havolasi (chegirma/kategoriya talabalar ilovasida)
  if (input.audience === "BUSINESSES" && input.linkType !== "HOME") return { ok: false, error: "invalid" };

  const schedule = checkSchedule(input.when, input.scheduledAt, now);
  if (!schedule.ok) return { ok: false, error: schedule.error };

  const created = await db.notification.create({
    data: {
      title: input.title,
      body: input.body,
      audience: input.audience,
      audienceIds: input.audience === "UNIVERSITY" || input.audience === "DISTRICT" ? input.audienceIds : [],
      linkType: input.linkType,
      linkId: input.linkType === "HOME" ? null : input.linkId,
      scheduledAt: schedule.at,
      createdById: actorId,
    },
    select: { id: true },
  });
  await audit({ actorId, action: "notification.create", entity: "Notification", entityId: created.id, meta: { audience: input.audience, immediate: schedule.immediate } });
  return { ok: true, id: created.id, immediate: schedule.immediate };
}

export type DispatchResult = "sent" | "skipped" | "failed";

export async function dispatchNotification(id: string, now = new Date()): Promise<DispatchResult> {
  const claimed = await db.notification.updateMany({
    where: { id, status: "SCHEDULED", scheduledAt: { lte: now }, audience: { not: "USER" } },
    // sentAt shu bosqichda "boshlangan payt" — to'xtab qolganini aniqlash uchun
    data: { status: "SENDING", sentAt: now },
  });
  if (claimed.count === 0) return "skipped";

  try {
    const n = await db.notification.findUniqueOrThrow({ where: { id } });
    if (n.audience === "USER") throw new Error("USER xabari admin orqali yuborilmaydi");
    const userIds = await audienceUserIds(n.audience, n.audienceIds);

    for (let i = 0; i < userIds.length; i += CHUNK) {
      await db.userNotification.createMany({ data: userIds.slice(i, i + CHUNK).map((userId) => ({ notificationId: id, userId })), skipDuplicates: true });
    }
    const home = n.audience === "BUSINESSES" ? "/biznes" : "/chegirmalar";
    await sendPushToUsers(userIds, pushPayload(n, notificationHref({ type: n.linkType, id: n.linkId }, home)));

    await db.notification.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), delivered: userIds.length } });
    return "sent";
  } catch (error) {
    console.error("[notifications] yuborilmadi:", id, error);
    await db.notification.update({ where: { id }, data: { status: "FAILED" } });
    return "failed";
  }
}

/** Muddati kelgan rejalashtirilgan xabarlarni yuboradi (cron va admin sahifasi ochilganda). */
export async function dispatchDue(now = new Date()): Promise<{ sent: number; failed: number; stuck: number }> {
  const stuck = await db.notification.updateMany({
    where: { status: "SENDING", sentAt: { lt: new Date(now.getTime() - STUCK_MINUTES * 60_000) } },
    data: { status: "FAILED" },
  });
  const due = await db.notification.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now }, audience: { not: "USER" } },
    orderBy: { scheduledAt: "asc" },
    take: 20,
    select: { id: true },
  });
  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    const result = await dispatchNotification(id, now);
    if (result === "sent") sent++;
    if (result === "failed") failed++;
  }
  return { sent, failed, stuck: stuck.count };
}

/** A3 "Yuborilganlar": oxirgi xabarlar (tizim xabarlari — USER — chiqmaydi), ochilish ulushi bilan. */
export async function notificationHistory(limit = 20) {
  const rows = await db.notification.findMany({ where: { audience: { not: "USER" } }, orderBy: { scheduledAt: "desc" }, take: limit });
  const opened = rows.length
    ? await db.userNotification.groupBy({ by: ["notificationId"], where: { notificationId: { in: rows.map((r) => r.id) }, readAt: { not: null } }, _count: { _all: true } })
    : [];
  const openedBy = new Map(opened.map((o) => [o.notificationId, o._count._all]));
  const universityIds = [...new Set(rows.filter((r) => r.audience === "UNIVERSITY").flatMap((r) => r.audienceIds))];
  const districtIds = [...new Set(rows.filter((r) => r.audience === "DISTRICT").flatMap((r) => r.audienceIds))];
  const [universities, districts] = await Promise.all([
    universityIds.length ? db.university.findMany({ where: { id: { in: universityIds } }, select: { id: true, shortName: true } }) : [],
    districtIds.length ? db.district.findMany({ where: { id: { in: districtIds } }, select: { id: true, name: true } }) : [],
  ]);
  const names = new Map<string, string>([...universities.map((u) => [u.id, u.shortName] as const), ...districts.map((d) => [d.id, d.name] as const)]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    audience: r.audience,
    audienceNames: r.audienceIds.map((id) => names.get(id)).filter((x): x is string => Boolean(x)),
    at: r.status === "SENT" || r.status === "SENDING" ? (r.sentAt ?? r.scheduledAt) : r.scheduledAt,
    status: r.status,
    delivered: r.delivered,
    opened: openedBy.get(r.id) ?? 0,
  }));
}
