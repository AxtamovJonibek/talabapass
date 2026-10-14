import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** SMS kod qoidalari — sof funksiyalar (bazasiz), testlar bilan. */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000;
/** Shuncha noto'g'ri urinishdan keyin kod bekor bo'ladi va raqam bloklanadi */
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_MS = 15 * 60_000;
/** Qayta yuborishdan oldingi kutish (ekrandagi taymer bilan bir xil) */
export const OTP_RESEND_MS = 60_000;
/** Bitta raqamga bir kunda (24 soat) yuboriladigan SMS chegarasi */
export const OTP_DAILY_LIMIT = 5;
/** Bitta IP'dan bir soatda qabul qilinadigan kod so'rovlari chegarasi */
export const OTP_IP_HOURLY_LIMIT = 10;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Kod bazada ochiq saqlanmaydi: telefon va server siri bilan HMAC. */
export function hashOtp(phone: string, code: string, secret: string): string {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

/** IP ham ochiq saqlanmaydi — chegarani hisoblash uchun faqat xeshi kerak. */
export function rateLimitKeyForIp(ip: string, secret: string): string {
  return `otp-ip:${createHmac("sha256", secret).update(`ip:${ip}`).digest("hex").slice(0, 32)}`;
}

export function otpMatches(phone: string, code: string, secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(phone, code, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type SendBlock = "ip_limit" | "locked" | "too_soon" | "daily_limit";
export type SendDecision = { ok: true } | { ok: false; reason: SendBlock; retryInMs: number };

export type SendContext = {
  /** Shu raqamga oxirgi 24 soatda yuborilgan kodlar vaqtlari */
  phoneSentAt: Date[];
  /** Shu IP'dan oxirgi 1 soatdagi so'rovlar vaqtlari (rad etilganlari bilan) */
  ipRequestsAt: Date[];
  /** Raqam xato urinishlar sabab bloklangan bo'lsa — tugash vaqti */
  lockedUntil: Date | null;
};

/** Yangi kod yuborish mumkinmi. Tartib: IP chegarasi → blok → 60 soniya → kunlik chegara. */
export function canSendOtp({ phoneSentAt, ipRequestsAt, lockedUntil }: SendContext, now: Date): SendDecision {
  const at = now.getTime();

  const ipHits = ipRequestsAt.map((d) => d.getTime()).filter((t) => t > at - HOUR_MS).sort((a, b) => a - b);
  if (ipHits.length >= OTP_IP_HOURLY_LIMIT) {
    return { ok: false, reason: "ip_limit", retryInMs: ipHits[ipHits.length - OTP_IP_HOURLY_LIMIT]! + HOUR_MS - at };
  }

  if (lockedUntil && lockedUntil.getTime() > at) {
    return { ok: false, reason: "locked", retryInMs: lockedUntil.getTime() - at };
  }

  const sent = phoneSentAt.map((d) => d.getTime()).filter((t) => t > at - DAY_MS).sort((a, b) => a - b);
  const last = sent[sent.length - 1];
  if (last !== undefined && at - last < OTP_RESEND_MS) {
    return { ok: false, reason: "too_soon", retryInMs: OTP_RESEND_MS - (at - last) };
  }
  if (sent.length >= OTP_DAILY_LIMIT) {
    return { ok: false, reason: "daily_limit", retryInMs: sent[sent.length - OTP_DAILY_LIMIT]! + DAY_MS - at };
  }
  return { ok: true };
}

export type OtpRecord = {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  lockedUntil: Date | null;
};
export type VerifyDecision = "ok" | "no_code" | "expired" | "locked" | "wrong";

/** Kiritilgan kodni oxirgi yuborilgan yozuv bilan solishtiradi. Blok har doim birinchi tekshiriladi. */
export function checkOtp(record: OtpRecord | null, phone: string, code: string, secret: string, now: Date): VerifyDecision {
  if (!record) return "no_code";
  if (record.lockedUntil && record.lockedUntil.getTime() > now.getTime()) return "locked";
  if (record.consumedAt) return "no_code";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  if (record.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  if (!/^\d{6}$/.test(code)) return "wrong";
  return otpMatches(phone, code, secret, record.codeHash) ? "ok" : "wrong";
}

/** Noto'g'ri urinishdan keyin: shu urinish bilan chegara to'ldimi (kod bekor + blok). */
export function shouldLock(attemptsAfterThisTry: number): boolean {
  return attemptsAfterThisTry >= OTP_MAX_ATTEMPTS;
}
