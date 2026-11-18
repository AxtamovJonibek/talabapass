import "server-only";
import { createTranslator } from "next-intl";
import messages from "../../../messages/uz.json";
import { parseIdentifier, type Identifier } from "@/lib/identifier";
import { db } from "../db";
import { sendEmail } from "../email";
import { emailLocale, resetCodeEmail } from "../email/templates";
import { EMAIL_CODE_TTL_MS, requestEmailCode, verifyEmailCode } from "./email-code";
import { recordIpRequest, requestOtp, verifyOtp } from "./otp";

/*
 * "Parolni unutdim": raqam yoki email → telefonga SMS kod (5 daqiqa) yoki emailga 6 raqamli kod (10 daqiqa, 5 urinish)
 * → kod to'g'ri bo'lsa yangi parol (chaqiruvchi qadam tokenini beradi va `savePassword(..., "reset")` qiladi).
 *
 * Hisob borligi oshkor qilinmaydi: so'rov javobi doim bir xil ("hisob bo'lsa, kod yuborildi"), kod faqat hisob bor bo'lsa
 * yuboriladi; hisobga bog'liq chegaralar (60 soniya, kunlik, raqam qulfi) ham javobga chiqmaydi — faqat IP chegarasi
 * (hisobdan qat'i nazar bir xil). Hisobi yo'q identifikatorga kod yo'q — tekshirishda "kod noto'g'ri/eskirgan".
 */

export const RESEND_SECONDS = 60;

export type ResetRequest =
  | { ok: true; channel: "sms" | "email"; resendInSeconds: number }
  | { ok: false; error: "identifier" }
  | { ok: false; error: "ipLimit"; retryInSeconds: number };

export type ResetVerify = { ok: true; userId: string; method: "phone" | "email" } | { ok: false; error: "identifier" | "wrongCode" | "expired" | "locked" };

const smsText = createTranslator({ locale: "uz", messages, namespace: "auth" });

/** Kirish mumkin bo'lgan hisob (admin — o'z yo'li, bloklangan/o'chirilgan — yo'q). */
async function recoverableUser(id: Identifier) {
  const user = await db.user.findUnique({
    where: id.kind === "phone" ? { phone: id.value } : { email: id.value },
    select: { id: true, role: true, status: true, locale: true },
  });
  return user && user.status === "ACTIVE" && user.role !== "ADMIN" ? user : null;
}

export async function requestPasswordReset(rawIdentifier: string, ip: string): Promise<ResetRequest> {
  const id = parseIdentifier(rawIdentifier);
  if (!id) return { ok: false, error: "identifier" };
  const channel = id.kind === "phone" ? "sms" : "email";
  const user = await recoverableUser(id);

  let decision;
  try {
    if (!user) decision = await recordIpRequest(ip);
    else if (id.kind === "phone") decision = await requestOtp(id.value, ip, (code) => smsText("resetSms", { code }));
    else {
      const locale = emailLocale(user.locale);
      decision = await requestEmailCode(id.value, ip, (code) => sendEmail({ to: id.value, ...resetCodeEmail(locale, code, EMAIL_CODE_TTL_MS / 60_000) }));
    }
  } catch (error) {
    // Yuborish xatosi ham javobda bilinmaydi (hisob borligini ko'rsatardi) — log'ga, kod yozuvsiz
    console.error(`Parol tiklash kodi yuborilmadi (${channel}):`, (error as Error).message);
    return { ok: true, channel, resendInSeconds: RESEND_SECONDS };
  }
  if (!decision.ok && decision.reason === "ip_limit") return { ok: false, error: "ipLimit", retryInSeconds: Math.ceil(decision.retryInMs / 1000) };
  return { ok: true, channel, resendInSeconds: RESEND_SECONDS };
}

export async function verifyPasswordReset(rawIdentifier: string, rawCode: string): Promise<ResetVerify> {
  const id = parseIdentifier(rawIdentifier);
  if (!id) return { ok: false, error: "identifier" };
  const code = rawCode.replace(/\D/g, "");
  const result = id.kind === "phone" ? await verifyOtp(id.value, code) : await verifyEmailCode(id.value, code);
  if (result !== "ok") return { ok: false, error: result === "locked" ? "locked" : result === "wrong" ? "wrongCode" : "expired" };
  // Raqamga ro'yxat kodi ham kelishi mumkin — hisob bo'lmasa kod "eskirgan" deb qaraladi
  const user = await recoverableUser(id);
  if (!user) return { ok: false, error: "expired" };
  return { ok: true, userId: user.id, method: id.kind };
}
