import "server-only";
import { createTranslator } from "next-intl";
import messages from "../../../messages/uz.json";
import { formatSom } from "@/lib/format";
import { BODY_MAX, clip, notificationHref, pushPayload, TITLE_MAX } from "@/lib/notifications";
import { db } from "../db";
import { sendSms } from "../sms";
import { sendPushToUsers } from "./push";

/**
 * Bitta foydalanuvchiga tizim xabari: talaba/biznes tasdiqlandi yoki rad etildi. Ilova ichi + push + SMS.
 * Qaror allaqachon saqlangan bo'ladi — bu yerdagi xato qarorni bekor qilmaydi (log'ga yoziladi, yutiladi).
 */

export type DirectEvent = "studentApproved" | "studentRejected" | "businessApproved" | "businessRejected";

type Params = { reason?: string };

const HOME: Record<DirectEvent, string> = {
  studentApproved: "/chegirmalar",
  studentRejected: "/chegirmalar",
  businessApproved: "/biznes",
  businessRejected: "/biznes",
};

export async function notifyUser(userId: string, event: DirectEvent, params: Params = {}, actorId?: string | null): Promise<void> {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, phone: true, status: true } });
    if (!user || user.status !== "ACTIVE") return;

    // createTranslator so'rov kontekstisiz ishlaydi (cron, test) — getTranslations faqat Next so'rovi ichida
    const t = createTranslator({ locale: "uz", messages, namespace: "notifications.direct" });
    // Sabab uzun bo'lishi mumkin — matn 150 belgidan oshmasligi uchun sabab qisqartiriladi
    const fixed = t(`${event}.body`, { reason: "" }).length;
    const reason = clip(params.reason ?? "", Math.max(0, BODY_MAX - fixed));
    const title = clip(t(`${event}.title`), TITLE_MAX);
    const body = clip(t(`${event}.body`, { reason }), BODY_MAX);

    const now = new Date();
    const notification = await db.notification.create({
      data: {
        title,
        body,
        audience: "USER",
        audienceIds: [userId],
        linkType: "HOME",
        scheduledAt: now,
        sentAt: now,
        status: "SENT",
        delivered: 1,
        createdById: actorId ?? userId,
        recipients: { create: { userId } },
      },
      select: { id: true, title: true, body: true },
    });

    await Promise.allSettled([
      sendPushToUsers([userId], pushPayload(notification, notificationHref({ type: "HOME" }, HOME[event]))),
      sendSms(user.phone, t("sms", { body })),
    ]).then((results) => {
      for (const r of results) if (r.status === "rejected") console.warn("[notifyUser]", event, (r.reason as Error).message);
    });
  } catch (error) {
    console.error("[notifyUser] xabar yuborilmadi:", event, userId, error);
  }
}

/**
 * Kassir sotuvni tasdiqladi — talabaga ilova ichi + push (SMS yo'q: talaba kassa oldida turibdi). Bosilsa — chek
 * (`/tarix?chek=<id>`). Xato sotuvni bekor qilmaydi.
 */
export async function notifyRedeemed(redemptionId: string): Promise<void> {
  try {
    const r = await db.redemption.findUnique({
      where: { id: redemptionId },
      select: { studentId: true, paidAmount: true, discountAmount: true, cashierId: true, coupon: { select: { termsTitle: true } }, business: { select: { name: true } }, student: { select: { status: true } } },
    });
    if (!r || r.student.status !== "ACTIVE") return;
    const t = createTranslator({ locale: "uz", messages, namespace: "notifications.direct" });
    const title = clip(t("couponRedeemed.title", { business: r.business.name }), TITLE_MAX);
    const body = clip(t("couponRedeemed.body", { item: r.coupon.termsTitle, paid: formatSom(r.paidAmount), saved: formatSom(r.discountAmount) }), BODY_MAX);
    const now = new Date();
    const notification = await db.notification.create({
      data: {
        title,
        body,
        audience: "USER",
        audienceIds: [r.studentId],
        linkType: "HOME",
        scheduledAt: now,
        sentAt: now,
        status: "SENT",
        delivered: 1,
        createdById: r.cashierId,
        recipients: { create: { userId: r.studentId } },
      },
      select: { id: true, title: true, body: true },
    });
    await sendPushToUsers([r.studentId], pushPayload(notification, `/tarix?chek=${redemptionId}`));
  } catch (error) {
    console.error("[notifyRedeemed] xabar yuborilmadi:", redemptionId, error);
  }
}
