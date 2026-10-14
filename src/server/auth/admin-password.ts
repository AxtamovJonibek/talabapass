import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Admin ikkinchi qadami: SMS koddan keyin parol. Sof funksiyalar (server-only emas — skript va testlardan ham).
 *
 * Parol faqat xesh ko'rinishida saqlanadi (`ADMIN_PASSWORD_HASH`, `npm run admin:hash`):
 *   scrypt:<N>:<r>:<p>:<salt base64url>:<xesh base64url>   (`$` emas — .env fayllarida `$` o'zgaruvchi deb ochiladi)
 * Parol to'g'ri bo'lsa joriy sessiyaga bog'langan imzolangan cookie beriladi — sessiya o'chsa (chiqish, bloklash)
 * cookie ham yaroqsiz.
 */
export const ADMIN_PASSWORD_MIN = 12;
export const ADMIN_UNLOCK_TTL_MS = 12 * 60 * 60_000;
export const ADMIN_MAX_FAILS = 5;
export const ADMIN_LOCK_MS = 15 * 60_000;

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

export function hashAdminPassword(password: string, salt: Buffer = randomBytes(16)): string {
  const hash = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join(":");
}

export function isAdminPasswordHash(stored: string | undefined): stored is string {
  return /^scrypt:\d+:\d+:\d+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(stored?.trim() ?? "");
}

/** Xesh yo'q yoki buzilgan bo'lsa — hech qanday parol to'g'ri emas. */
export function verifyAdminPassword(password: string, stored: string | undefined): boolean {
  if (!password || !isAdminPasswordHash(stored)) return false;
  const [, n, r, p, salt, hash] = stored.trim().split(":");
  const expected = Buffer.from(hash!, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = scryptSync(password, Buffer.from(salt!, "base64url"), KEY_LENGTH, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(actual, expected);
}

const mac = (secret: string, sessionHash: string, expires: number) =>
  createHmac("sha256", secret).update(`admin-unlock:${sessionHash}:${expires}`).digest("base64url");

export function signAdminUnlock(secret: string, sessionHash: string, now = Date.now()): string {
  const expires = now + ADMIN_UNLOCK_TTL_MS;
  return `${expires}.${mac(secret, sessionHash, expires)}`;
}

export function checkAdminUnlock(secret: string, sessionHash: string, value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const [expiresRaw, given] = value.split(".");
  const expires = Number(expiresRaw);
  if (!given || !Number.isSafeInteger(expires) || expires <= now) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(mac(secret, sessionHash, expires));
  return a.length === b.length && timingSafeEqual(a, b);
}
