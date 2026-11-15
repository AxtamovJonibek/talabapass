import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cleanPassword } from "@/lib/password";
import { db } from "../db";
import { authSecret } from "../env";
import { hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { authCookieOptions as cookieOptions } from "./cookie-options";

/*
 * Ilova paroli (design/app-flow). Kirish: telefon → SMS kod → parol. Parol SMS koddan KEYIN so'raladi —
 * raqam ro'yxatdan o'tganmi, begona odam bila olmaydi. Xesh — admin paroli bilan bir xil scrypt formati.
 *
 * Qadamlar orasidagi holat imzolangan cookie'larda (bazada emas):
 * - `tp_pw_step` — SMS bilan tasdiqlangan raqam va keyingi qadam (10 daqiqa): `login` (parol kiritish yoki
 *   "Parolni unutdim"), `set` (eski hisob — parol hali yo'q), `new:student|business` (yangi raqam);
 * - `tp_new_pw` — yangi raqamning tayyor parol xeshi (30 daqiqa): ro'yxat formasi hisobni ochganda yoziladi.
 */

const STEP_COOKIE = "tp_pw_step";
const PENDING_COOKIE = "tp_new_pw";
const STEP_TTL_MS = 10 * 60_000;
const PENDING_TTL_MS = 30 * 60_000;

export const PASSWORD_MAX_FAILS = 5;
export const PASSWORD_LOCK_MS = 15 * 60_000;

export type PasswordStep = "login" | "set" | "new:student" | "new:business";

export const hashPassword = (password: string) => hashAdminPassword(cleanPassword(password));
export const checkPassword = (password: string, hash: string | null) => Boolean(hash) && verifyAdminPassword(password, hash ?? undefined);

const mac = (label: string, payload: string) => createHmac("sha256", authSecret()).update(`${label}:${payload}`).digest("base64url");

async function writeSigned(name: string, label: string, parts: string[], ttl: number) {
  const payload = [...parts, String(Date.now() + ttl)].join(".");
  (await cookies()).set(name, `${payload}.${mac(label, payload)}`, cookieOptions(ttl));
}

/** Imzo va muddat to'g'ri bo'lsa — qismlar (muddatsiz), aks holda null. */
async function readSigned(name: string, label: string): Promise<string[] | null> {
  const raw = (await cookies()).get(name)?.value;
  if (!raw) return null;
  const cut = raw.lastIndexOf(".");
  const payload = raw.slice(0, cut);
  const given = Buffer.from(raw.slice(cut + 1));
  const expected = Buffer.from(mac(label, payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const parts = payload.split(".");
  const expires = Number(parts.pop());
  return expires > Date.now() ? parts : null;
}

export async function rememberPasswordStep(phone: string, step: PasswordStep): Promise<void> {
  await writeSigned(STEP_COOKIE, "password-step", [phone, step], STEP_TTL_MS);
}

export async function getPasswordStep(): Promise<{ phone: string; step: PasswordStep } | null> {
  const parts = await readSigned(STEP_COOKIE, "password-step");
  if (!parts || parts.length !== 2) return null;
  return { phone: parts[0]!, step: parts[1] as PasswordStep };
}

export async function forgetPasswordStep(): Promise<void> {
  (await cookies()).delete(STEP_COOKIE);
}

/** Yangi raqam: parol hisob ochilguncha xesh ko'rinishida imzolangan cookie'da turadi. */
export async function rememberPendingPassword(phone: string, hash: string): Promise<void> {
  await writeSigned(PENDING_COOKIE, "pending-password", [phone, hash], PENDING_TTL_MS);
}

/**
 * Ro'yxat formasi hisob ochgach chaqiradi: shu raqam uchun ilovada o'rnatilgan parol bo'lsa — hisobga yoziladi.
 * Saytdan ro'yxatdan o'tishda cookie yo'q — hech narsa qilmaydi.
 */
export async function applyPendingPassword(userId: string, phone: string): Promise<void> {
  const parts = await readSigned(PENDING_COOKIE, "pending-password");
  if (!parts || parts[0] !== phone || !parts[1]) return;
  await db.user.update({ where: { id: userId }, data: { passwordHash: parts[1], passwordFails: 0, passwordLockedUntil: null } });
  (await cookies()).delete(PENDING_COOKIE);
}

export type PasswordCheck = { ok: true } | { ok: false; reason: "wrong"; left: number } | { ok: false; reason: "locked"; retryInSeconds: number };

/**
 * Parolni tekshiradi va xatolarni sanaydi: 5 ta ketma-ket xato — 15 daqiqa qulf (to'g'ri parol ham qabul qilinmaydi).
 * Hisoblagich bitta atom `increment` bilan — parallel urinishlar ham sanaladi.
 */
export async function attemptPassword(
  user: { id: string; passwordHash: string | null; passwordLockedUntil: Date | null },
  password: string,
  now = new Date(),
): Promise<PasswordCheck> {
  if (user.passwordLockedUntil && user.passwordLockedUntil > now) {
    return { ok: false, reason: "locked", retryInSeconds: Math.ceil((user.passwordLockedUntil.getTime() - now.getTime()) / 1000) };
  }
  if (checkPassword(password, user.passwordHash)) {
    await db.user.update({ where: { id: user.id }, data: { passwordFails: 0, passwordLockedUntil: null } });
    return { ok: true };
  }
  const { passwordFails } = await db.user.update({ where: { id: user.id }, data: { passwordFails: { increment: 1 } }, select: { passwordFails: true } });
  if (passwordFails >= PASSWORD_MAX_FAILS) {
    await db.user.update({ where: { id: user.id }, data: { passwordFails: 0, passwordLockedUntil: new Date(now.getTime() + PASSWORD_LOCK_MS) } });
    return { ok: false, reason: "locked", retryInSeconds: PASSWORD_LOCK_MS / 1000 };
  }
  return { ok: false, reason: "wrong", left: PASSWORD_MAX_FAILS - passwordFails };
}
