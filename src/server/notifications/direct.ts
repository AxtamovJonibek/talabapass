import "server-only";
import { createTranslator } from "next-intl";
import messages from "../../../messages/uz.json";
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
