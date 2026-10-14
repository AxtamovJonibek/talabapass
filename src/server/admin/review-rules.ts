import { toTashkent } from "@/lib/time";

/** Admin tekshiruvi qoidalari — sof funksiyalar (test bilan). */

/** Rad etish sabablari (A2 ro'yxati). Matnlar messages'da: admin.review.reasons.<kalit> */
export const STUDENT_REJECT_REASONS = ["expired", "unclear", "mismatch", "fake"] as const;
export const BUSINESS_REJECT_REASONS = ["tin", "documents", "photos", "contact"] as const;
export type StudentRejectReason = (typeof STUDENT_REJECT_REASONS)[number];
export const DISCOUNT_REJECT_REASONS = ["misleading", "prohibited", "unclear", "duplicate"] as const;
export type DiscountRejectReason = (typeof DISCOUNT_REJECT_REASONS)[number];
export type BusinessRejectReason = (typeof BUSINESS_REJECT_REASONS)[number];

/** Guvohnoma raqami: harf, raqam, chiziqcha; bo'sh joylarsiz, katta harfda saqlanadi. */
export function normalizeCardNumber(input: string): string | null {
  const value = input.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9][A-Z0-9-]{2,29}$/.test(value) ? value : null;
}

/** "2027-06-30" (input[type=date]) → UTC yarim tun sanasi. Noto'g'ri yoki mavjud bo'lmagan sana — null. */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCDate() === Number(m[3]) && date.getUTCMonth() === Number(m[2]) - 1 ? date : null;
}

export type ExpiryCheck = "valid" | "expired" | "too_far";

/** Guvohnoma amal muddati: bugungi (Toshkent) kundan oldin bo'lmasin va 7 yildan uzoq bo'lmasin. */
export function checkCardExpiry(expiresAt: Date, now: Date): ExpiryCheck {
  const today = toTashkent(now).date;
  if (expiresAt.getTime() < today.getTime()) return "expired";
  const limit = new Date(Date.UTC(today.getUTCFullYear() + 7, today.getUTCMonth(), today.getUTCDate()));
  return expiresAt.getTime() > limit.getTime() ? "too_far" : "valid";
}

/** "12 daq", "2 soat", "1 kun" — navbatdagi ariza qachon yuborilgan. */
export function ageLabel(from: Date, now: Date): { value: number; unit: "min" | "hour" | "day" } {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return { value: minutes, unit: "min" };
  if (minutes < 24 * 60) return { value: Math.floor(minutes / 60), unit: "hour" };
  return { value: Math.floor(minutes / (24 * 60)), unit: "day" };
}

/** O'rtacha kutish: "1 s 40 daq" kabi ko'rsatish uchun soat va daqiqa. */
export function averageWait(pairs: { createdAt: Date; reviewedAt: Date }[]): { hours: number; minutes: number } | null {
  if (pairs.length === 0) return null;
  const total = pairs.reduce((sum, p) => sum + Math.max(0, p.reviewedAt.getTime() - p.createdAt.getTime()), 0);
  const minutes = Math.round(total / pairs.length / 60_000);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
