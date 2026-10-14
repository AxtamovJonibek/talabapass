import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Kompyuterdan telefonga o'tish havolasi uchun qisqa muddatli token (WT1: "Telefon bilan rasmga olish").
 * Token faqat bitta ish qiladi: ko'rsatilgan talaba nomidan guvohnoma yuklash. Sessiya bermaydi.
 * Sof funksiyalar — sir tashqaridan beriladi (test bilan).
 */
export const UPLOAD_TOKEN_TTL_MS = 15 * 60_000;

// Token QR kodga sig'ishi uchun ixcham: muddat — 36 lik sanoqdagi soniyalar, imzo — HMAC-SHA256 ning 96 biti.
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(`card-upload:${payload}`).digest("base64url").slice(0, 16);

export function createUploadToken(userId: string, secret: string, now: Date = new Date()): string {
  const payload = `${userId}.${Math.floor((now.getTime() + UPLOAD_TOKEN_TTL_MS) / 1000).toString(36)}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Token to'g'ri va muddati o'tmagan bo'lsa — talaba id'si, aks holda null. */
export function readUploadToken(token: string, secret: string, now: Date = new Date()): string | null {
  const cut = token.lastIndexOf(".");
  if (cut <= 0) return null;
  const payload = token.slice(0, cut);
  const given = Buffer.from(token.slice(cut + 1));
  const expected = Buffer.from(sign(payload, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [userId, expires] = payload.split(".");
  return userId && expires && parseInt(expires, 36) * 1000 > now.getTime() ? userId : null;
}
