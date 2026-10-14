/**
 * Sinov serveri (`APP_ENV=staging`) uchun Basic Auth — proxy.ts chaqiradi. Foydalanuvchi nomi ixtiyoriy, faqat parol
 * (`STAGING_PASSWORD`) tekshiriladi. Parol yo'q bo'lsa hech kim o'tmaydi (server baribir ishga tushmaydi — env-check.ts).
 */
export const STAGING_REALM = "talabaPass sinov";

/** Uzunlik va mazmun bo'yicha vaqti teng solishtirish (Edge va Node'da bir xil ishlaydi). */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function stagingAuthorized(header: string | null, password: string | undefined): boolean {
  if (!password || !header) return false;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
  if (!match) return false;
  let decoded: string;
  try {
    decoded = atob(match[1]!);
  } catch {
    return false;
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return false;
  return safeEqual(decoded.slice(colon + 1), password);
}
