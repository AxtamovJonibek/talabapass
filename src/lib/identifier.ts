import { normalizePhone } from "./format";

/**
 * Kirish identifikatori: telefon raqam yoki email (forma va server bitta funksiyani ishlatadi).
 * "@" bo'lsa — email (kichik harflarga), aks holda O'zbekiston raqami (E.164). Tanilmasa — null.
 */
export const EMAIL_MAX = 254;

export type Identifier = { kind: "phone"; value: string } | { kind: "email"; value: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= EMAIL_MAX && EMAIL_RE.test(email) ? email : null;
}

export function parseIdentifier(raw: string): Identifier | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.includes("@")) {
    const email = normalizeEmail(text);
    return email ? { kind: "email", value: email } : null;
  }
  const phone = normalizePhone(text);
  return phone ? { kind: "phone", value: phone } : null;
}

/** "dilnoza.k@gmail.com" → "di•••@gmail.com" (kod qayerga yuborilgani; to'liq manzil ko'rsatilmaydi) */
export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, Math.min(2, Math.max(1, name.length - 1)))}•••@${domain}`;
}
