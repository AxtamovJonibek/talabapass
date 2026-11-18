import "server-only";
import { cleanPassword } from "@/lib/password";
import { audit } from "../audit";
import { db } from "../db";
import { hashAdminPassword, verifyAdminPassword } from "./admin-password";

/*
 * Foydalanuvchi paroli (sayt va ilova bir xil): scrypt, admin paroli bilan bir xil format. Kirish — identifikator
 * (telefon yoki email) + parol (`login.ts`); SMS/email kodi faqat raqamni tasdiqlash (ro'yxat) va "Parolni unutdim" uchun.
 * Saytdagi qadam cookie'lari — `password-steps.ts`, API'dagi muhrlangan qadam tokenlari — `api/auth-flow.ts`.
 */

export const PASSWORD_MAX_FAILS = 5;
export const PASSWORD_LOCK_MS = 15 * 60_000;

export const hashPassword = (password: string) => hashAdminPassword(cleanPassword(password));
export const checkPassword = (password: string, hash: string | null) => Boolean(hash) && verifyAdminPassword(password, hash ?? undefined);

/** Hisob yo'q bo'lganda ham bir xil vaqt sarflansin (scrypt) — javob tezligidan hisob borligi bilinmasin. */
const DUMMY_HASH = hashAdminPassword("talabapass-dummy-password-0");
export const burnPasswordCheck = (password: string) => void verifyAdminPassword(password || "x", DUMMY_HASH);

export type PasswordCheck = { ok: true } | { ok: false; reason: "wrong"; left: number } | { ok: false; reason: "locked"; retryInSeconds: number; fresh: boolean };

/**
 * Parolni tekshiradi va xatolarni sanaydi: 5 ta ketma-ket xato — 15 daqiqa qulf (to'g'ri parol ham qabul qilinmaydi).
 * Hisoblagich bitta atom `increment` bilan — parallel urinishlar ham sanaladi. `fresh` — qulf aynan shu urinishda tushdi.
 */
export async function attemptPassword(
  user: { id: string; passwordHash: string | null; passwordLockedUntil: Date | null },
  password: string,
  now = new Date(),
): Promise<PasswordCheck> {
  if (user.passwordLockedUntil && user.passwordLockedUntil > now) {
    return { ok: false, reason: "locked", fresh: false, retryInSeconds: Math.ceil((user.passwordLockedUntil.getTime() - now.getTime()) / 1000) };
  }
  if (checkPassword(password, user.passwordHash)) {
    await db.user.update({ where: { id: user.id }, data: { passwordFails: 0, passwordLockedUntil: null } });
    return { ok: true };
  }
  const { passwordFails } = await db.user.update({ where: { id: user.id }, data: { passwordFails: { increment: 1 } }, select: { passwordFails: true } });
  if (passwordFails >= PASSWORD_MAX_FAILS) {
    await db.user.update({ where: { id: user.id }, data: { passwordFails: 0, passwordLockedUntil: new Date(now.getTime() + PASSWORD_LOCK_MS) } });
    return { ok: false, reason: "locked", fresh: true, retryInSeconds: PASSWORD_LOCK_MS / 1000 };
  }
  return { ok: false, reason: "wrong", left: PASSWORD_MAX_FAILS - passwordFails };
}

/** Qayerdan: sayt brauzerda, Capacitor ilova (`tp_app`) yoki native ilova API'si. */
export type AuthVia = "web" | "app" | "api";
export type AuthMethod = "phone" | "email" | "google" | "apple";
/** Audit uchun qurilma: ilova yuborgan nom yoki brauzer user-agent'i (qisqartirilgan). */
export type AuthContext = { via: AuthVia; deviceName?: string | null; userAgent?: string | null };

export const contextMeta = (ctx: AuthContext) => ({
  via: ctx.via,
  ...(ctx.deviceName ? { device: ctx.deviceName.slice(0, 80) } : {}),
  ...(ctx.userAgent ? { ua: ctx.userAgent.slice(0, 200) } : {}),
});

/** `set` — birinchi parol (yangi hisob yoki parolsiz eski hisob), `change` — o'zi almashtirdi, `reset` — "Parolni unutdim". */
export type PasswordChange = "set" | "change" | "reset";

/**
 * Parolni yozadi: qulf va "keyingi kirishda almashtirish" belgisi tushadi, vaqtlar yangilanadi, audit. Parol va xesh
 * log'ga yozilmaydi. `reset` — barcha sessiyalar yopiladi (`keepSessionId` dan tashqari — o'sha so'rovda ochilgani).
 */
export async function savePassword(
  userId: string,
  hash: string,
  kind: PasswordChange,
  ctx: AuthContext,
  { method, keepSessionId, closeOthers = kind === "reset" }: { method?: AuthMethod; keepSessionId?: string; closeOthers?: boolean } = {},
): Promise<void> {
  const now = new Date();
  await db.$transaction(async (tx) => {
    const { passwordSetAt } = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordSetAt: true } });
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: hash, passwordFails: 0, passwordLockedUntil: null, passwordResetRequired: false, passwordChangedAt: now, passwordSetAt: passwordSetAt ?? now },
    });
    if (closeOthers) await tx.session.deleteMany({ where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) } });
    await audit({ actorId: userId, action: `user.password.${kind}`, entity: "User", entityId: userId, meta: { ...contextMeta(ctx), ...(method ? { method } : {}) } }, tx);
  });
}
