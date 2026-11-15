import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

/**
 * Kupon QR tokeni va 6 raqamli kod — saytdagi `src/lib/totp.ts` bilan AYNAN bir xil algoritm (kassir skaneri server
 * tomonda shu bilan tekshiradi). Farqi: Hermes'da `crypto.subtle` yo'q, HMAC-SHA256 — @noble/hashes (sof JS,
 * sinxron, internetsiz ishlaydi).
 *
 *   QR  = `<kupon kodi>.<oyna>.<HMAC-SHA256(secret, "tp-qr:<kod>:<oyna>") ning 128 biti, base64url>`
 *   kod = RFC 4226 dinamik qisqartirish: HMAC-SHA256(secret, 8 baytli oyna raqami) → 6 raqam
 */

export const WINDOW_SECONDS = 60;
export const CODE_DIGITS = 6;

export const windowAt = (ms: number) => Math.floor(ms / 1000 / WINDOW_SECONDS);
/** Oyna tugashiga qolgan soniya (QR yangilanish taymeri) */
export const secondsLeftInWindow = (ms: number) => WINDOW_SECONDS - (Math.floor(ms / 1000) % WINDOW_SECONDS);

const encoder = new TextEncoder();

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
export function qrToken(code: string, secret: Uint8Array, window: number): string {
  const mac = hmac(sha256, secret, encoder.encode(`tp-qr:${code}:${window}`));
  return `${code}.${window}.${toBase64Url(mac.slice(0, 16))}`;
}

/** 6 raqamli kod (shu oyna uchun) — qo'lda kiritish uchun, kupon kodi bilan birga. */
export function totpCode(secret: Uint8Array, window: number): string {
  const mac = hmac(sha256, secret, counterBytes(window));
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(binary % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, "0");
}

/** 600 000 → "10:00" */
export const formatTimer = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
