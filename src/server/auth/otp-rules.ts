import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** SMS kod qoidalari — sof funksiyalar (bazasiz), testlar bilan. */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
/** Qayta yuborishdan oldingi kutish (ekrandagi taymer bilan bir xil) */
export const OTP_RESEND_MS = 60_000;
/** Bir raqamga bir soatda yuboriladigan kodlar chegarasi */
export const OTP_HOURLY_LIMIT = 5;

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Kod bazada ochiq saqlanmaydi: telefon va server siri bilan HMAC. */
export function hashOtp(phone: string, code: string, secret: string): string {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

export function otpMatches(phone: string, code: string, secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(phone, code, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type SendDecision = { ok: true } | { ok: false; reason: "too_soon" | "hourly_limit"; retryInMs: number };

/** Yangi kod yuborish mumkinmi: oxirgi kodlar vaqtlari bo'yicha. */
export function canSendOtp(recentSentAt: Date[], now: Date): SendDecision {
  const times = recentSentAt.map((d) => d.getTime()).sort((a, b) => b - a);
  const last = times[0];
  if (last !== undefined && now.getTime() - last < OTP_RESEND_MS) {
    return { ok: false, reason: "too_soon", retryInMs: OTP_RESEND_MS - (now.getTime() - last) };
  }
  const hourAgo = now.getTime() - 3_600_000;
  const inHour = times.filter((t) => t > hourAgo);
  if (inHour.length >= OTP_HOURLY_LIMIT) {
    return { ok: false, reason: "hourly_limit", retryInMs: inHour[inHour.length - 1]! + 3_600_000 - now.getTime() };
  }
  return { ok: true };
}

export type OtpRecord = { codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null };
export type VerifyDecision = "ok" | "no_code" | "expired" | "locked" | "wrong";

/** Kiritilgan kodni oxirgi yuborilgan yozuv bilan solishtiradi. */
export function checkOtp(record: OtpRecord | null, phone: string, code: string, secret: string, now: Date): VerifyDecision {
  if (!record || record.consumedAt) return "no_code";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  if (record.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  if (!/^\d{6}$/.test(code)) return "wrong";
  return otpMatches(phone, code, secret, record.codeHash) ? "ok" : "wrong";
}
