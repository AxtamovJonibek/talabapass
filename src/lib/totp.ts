/**
 * Kupon QR tokeni va 6 raqamli kod — offline TOTP (RFC 6238 uslubi, 60 soniyalik oyna).
 * Klient (talaba telefoni, internetsiz) va server (kassir skaneri) AYNAN shu koddan foydalanadi: Web Crypto
 * (`crypto.subtle`) brauzerda ham, Node'da ham bor.
 *
 *   QR  = `<kupon kodi>.<oyna>.<HMAC-SHA256(secret, "tp-qr:<kod>:<oyna>") ning 128 biti, base64url>`
 *   kod = RFC 4226 dinamik qisqartirish: HMAC-SHA256(secret, 8 baytli oyna raqami) → 6 raqam
 *
 * Secret kuponga xos (160 bit), faqat kupon egasining qurilmasida va serverda (shifrlangan) turadi.
 * Ekrandagi QR yoki kodning skrinshoti ko'pi bilan ~2 daqiqa (oyna ±1) yaraydi.
 */

export const WINDOW_SECONDS = 60;
/** Server qabul qiladigan oyna farqi: soatlar biroz farq qilsa ham (±1 daqiqa) */
export const WINDOW_SKEW = 1;
export const CODE_DIGITS = 6;

/** Kupon kodi: "TP-7K3Q-92XD" (o'xshash belgilar — 0/O, 1/I — yo'q) */
export const COUPON_CODE_RE = /^TP-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
const QR_RE = /^(TP-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4})\.(\d{1,12})\.([A-Za-z0-9_-]{22})$/;

export const windowAt = (ms: number) => Math.floor(ms / 1000 / WINDOW_SECONDS);
/** Oyna tugashiga qolgan soniya (QR yangilanish taymeri) */
export const secondsLeftInWindow = (ms: number) => WINDOW_SECONDS - (Math.floor(ms / 1000) % WINDOW_SECONDS);

const encoder = new TextEncoder();

async function hmac(secret: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", secret as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, message as BufferSource));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function counterBytes(window: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let value = window;
  for (let i = 7; i >= 0; i--) {
    bytes[i] = value % 256;
    value = Math.floor(value / 256);
  }
  return bytes;
}

/** QR ichidagi matn (shu oyna uchun). */
export async function qrToken(code: string, secret: Uint8Array, window: number): Promise<string> {
  const mac = await hmac(secret, encoder.encode(`tp-qr:${code}:${window}`));
  return `${code}.${window}.${toBase64Url(mac.slice(0, 16))}`;
}

/** 6 raqamli kod (shu oyna uchun) — qo'lda kiritish uchun, kupon kodi bilan birga. */
export async function totpCode(secret: Uint8Array, window: number): Promise<string> {
  const mac = await hmac(secret, counterBytes(window));
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(binary % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, "0");
}

export type ParsedQr = { code: string; window: number; tag: string };

/** QR matnini ajratish; format noto'g'ri bo'lsa null. */
export function parseQr(text: string): ParsedQr | null {
  const m = QR_RE.exec(text.trim());
  return m ? { code: m[1]!, window: Number(m[2]), tag: m[3]! } : null;
}

/** Kiritilgan kupon kodini bir xil ko'rinishga keltirish: "tp 7k3q 92xd" → "TP-7K3Q-92XD". */
export function normalizeCouponCode(value: string): string {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const body = raw.startsWith("TP") ? raw.slice(2) : raw;
  return body.length === 8 ? `TP-${body.slice(0, 4)}-${body.slice(4)}` : value.trim().toUpperCase();
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type QrCheck = "ok" | "stale" | "invalid";

/**
 * QR tekshiruvi: oyna joriy oynadan ±1 ichida bo'lishi ("stale" — eski skrinshot yoki soat juda farqli),
 * imzo shu kupon secret'i bilan mos ("invalid").
 */
export async function verifyQr(parsed: ParsedQr, secret: Uint8Array, nowMs: number): Promise<QrCheck> {
  if (Math.abs(parsed.window - windowAt(nowMs)) > WINDOW_SKEW) return "stale";
  const expected = (await qrToken(parsed.code, secret, parsed.window)).split(".")[2]!;
  return equal(expected, parsed.tag) ? "ok" : "invalid";
}

/** 6 raqamli kod: joriy oyna ±1. Faqat 6 ta raqam qabul qilinadi. */
export async function verifyCode(code: string, secret: Uint8Array, nowMs: number): Promise<boolean> {
  if (!new RegExp(`^\\d{${CODE_DIGITS}}$`).test(code)) return false;
  const now = windowAt(nowMs);
  let ok = false;
  for (let w = now - WINDOW_SKEW; w <= now + WINDOW_SKEW; w++) {
    if (equal(await totpCode(secret, w), code)) ok = true;
  }
  return ok;
}
