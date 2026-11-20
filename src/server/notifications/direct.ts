import "server-only";
import { createTranslator } from "next-intl";
import messages from "../../../messages/uz.json";
import { formatSom } from "@/lib/format";
import { BODY_MAX, clip, notificationHref, pushPayload, TITLE_MAX } from "@/lib/notifications";
import { db } from "../db";
import { sendSms } from "../sms";
import { sendExpoPush } from "./expo-push";
import { sendPushToUsers } from "./push";

/**
 * Bitta foydalanuvchiga tizim xabari: talaba/biznes tasdiqlandi yoki rad etildi. Ilova ichi + push + SMS.
 * Qaror allaqachon saqlangan bo'ladi — bu yerdagi xato qarorni bekor qilmaydi (log'ga yoziladi, yutiladi).
 */

export type DirectEvent = "studentApproved" | "studentRejected" | "businessApproved" | "businessRejected" | "businessBlocked";

type Params = { reason?: string };

/** Ilova qurilmasining tilidagi qisqa matnlar (ilova ichidagi xabar va veb-push — o'zbekcha, `messages/uz.json`). */
const APP_TEXT: Record<"ru" | "en", Record<DirectEvent, { title: string; body: string }>> = {
  ru: {
    studentApproved: { title: "Студенчество подтверждено", body: "" },
    studentRejected: { title: "Документ отклонён", body: "{reason}" },
    businessApproved: { title: "Ваш бизнес подтверждён", body: "" },
    businessRejected: { title: "Заявка отклонена", body: "{reason}" },
    businessBlocked: { title: "Бизнес заблокирован", body: "{reason}" },
  },
  en: {
    studentApproved: { title: "Student status confirmed", body: "" },
    studentRejected: { title: "Document rejected", body: "{reason}" },
    businessApproved: { title: "Your business is approved", body: "" },
    businessRejected: { title: "Application rejected", body: "{reason}" },
    businessBlocked: { title: "Business blocked", body: "{reason}" },
  },
};

const HOME: Record<DirectEvent, string> = {
  studentApproved: "/chegirmalar",
  studentRejected: "/chegirmalar",
  businessApproved: "/biznes",
  businessRejected: "/biznes",
  businessBlocked: "/biznes",
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

    const url = notificationHref({ type: "HOME" }, HOME[event]);
    const appPush = (["uz", "ru", "en"] as const).map((locale) => {
      const text = locale === "uz" ? { title, body } : { title: APP_TEXT[locale][event].title, body: clip(APP_TEXT[locale][event].body.replace("{reason}", reason), BODY_MAX) };
      return sendExpoPush([userId], { title: text.title, body: text.body, data: { url, id: notification.id } }, undefined, locale);
    });
    await Promise.allSettled([
      sendPushToUsers([userId], pushPayload(notification, url), { skipApp: true }),
      ...appPush,
      // Raqamsiz (Google/Apple) hisobga SMS yo'q — ilova ichi va push yetadi
      user.phone ? sendSms(user.phone, t("sms", { body: body ? `${title}: ${body}` : title })) : Promise.resolve(),
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
