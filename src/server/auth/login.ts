import "server-only";
import { createHmac } from "node:crypto";
import type { Role } from "@/generated/prisma/client";
import { maskEmail, parseIdentifier, type Identifier } from "@/lib/identifier";
import { audit } from "../audit";
import { cashierBusiness } from "../business/cashiers";
import { db } from "../db";
import { authSecret } from "../env";
import { attemptPassword, burnPasswordCheck, contextMeta, PASSWORD_LOCK_MS, PASSWORD_MAX_FAILS, type AuthContext, type AuthMethod } from "./password";

/*
 * Kirish: "Telefon raqam yoki email" + parol (sayt, Capacitor ilova va API bitta funksiya). SMS kod so'ralmaydi.
 *
 * Hisob borligi oshkor bo'lmaydi: hisob yo'q, parol o'rnatilmagan, admin (o'z kirishi bor) yoki parol xato — javob bitta
 * (`invalid`), vaqt ham bir xil (scrypt baribir hisoblanadi). Qulf ham hisobi yo'q identifikatorda xuddi shunday ishlaydi
 * (`RateLimitHit` dagi "arvoh" hisob): 5 ta xato → 15 daqiqa. Bloklangan hisob va biznessiz kassir haqida faqat parol
 * TO'G'RI bo'lganda aytiladi (egasi ekani isbotlangan).
 */

export type LoginResult =
  | { ok: true; userId: string; role: Role; method: AuthMethod; mustSetPassword: boolean }
  | { ok: false; error: "invalid" }
  | { ok: false; error: "locked"; retryInSeconds: number }
  | { ok: false; error: "blocked" | "noBusiness" };

const ghostKey = (id: Identifier) => `login-ghost:${createHmac("sha256", authSecret()).update(`login:${id.value}`).digest("hex").slice(0, 32)}`;

/** Hisobi yo'q (yoki paroli yo'q) identifikator uchun hisoblagich — haqiqiy hisobdagi qulf bilan bir xil xatti-harakat. */
async function ghostAttempt(id: Identifier, now: Date): Promise<LoginResult> {
  const key = ghostKey(id);
  const hits = await db.rateLimitHit.findMany({
    where: { key, createdAt: { gt: new Date(now.getTime() - 2 * PASSWORD_LOCK_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (hits.length >= PASSWORD_MAX_FAILS) {
    const until = hits[0]!.createdAt.getTime() + PASSWORD_LOCK_MS;
    if (until > now.getTime()) return { ok: false, error: "locked", retryInSeconds: Math.ceil((until - now.getTime()) / 1000) };
    // Qulf tugadi — hisoblagich noldan (haqiqiy hisobdagidek)
    await db.rateLimitHit.deleteMany({ where: { key } });
  }
  await db.rateLimitHit.create({ data: { key, createdAt: now } });
  const count = (hits.length >= PASSWORD_MAX_FAILS ? 0 : hits.length) + 1;
  return count >= PASSWORD_MAX_FAILS ? { ok: false, error: "locked", retryInSeconds: PASSWORD_LOCK_MS / 1000 } : { ok: false, error: "invalid" };
}

/** Audit: identifikator to'liq yozilmaydi (hisobi yo'q odamning raqami/emaili ham shaxsiy ma'lumot). */
const maskedIdentifier = (id: Identifier) => (id.kind === "email" ? maskEmail(id.value) : `${id.value.slice(0, 6)}•••${id.value.slice(-2)}`);

async function logFail(id: Identifier, userId: string | null, ctx: AuthContext, reason: string) {
  await audit({
    actorId: userId,
    action: "user.login.fail",
    entity: "User",
    entityId: userId,
    meta: { method: id.kind, reason, identifier: maskedIdentifier(id), ...contextMeta(ctx) },
  });
}

/** Muvaffaqiyatli kirish: `lastLoginAt` va audit (sessiyani chaqiruvchi ochadi). Google/Apple kirishi ham shu. */
export async function recordLogin(userId: string, method: AuthMethod, ctx: AuthContext): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: userId, action: "user.login.ok", entity: "User", entityId: userId, meta: { method, ...contextMeta(ctx) } });
}

export async function checkLogin(rawIdentifier: string, password: string, ctx: AuthContext, now = new Date()): Promise<LoginResult> {
  const id = parseIdentifier(rawIdentifier);
  if (!id) {
    burnPasswordCheck(password);
    return { ok: false, error: "invalid" };
  }
  const user = await db.user.findUnique({
    where: id.kind === "phone" ? { phone: id.value } : { email: id.value },
    select: { id: true, role: true, status: true, passwordHash: true, passwordLockedUntil: true, passwordResetRequired: true },
  });

  if (!user || !user.passwordHash || user.role === "ADMIN" || user.status === "DELETED") {
    burnPasswordCheck(password);
    const result = await ghostAttempt(id, now);
    await logFail(id, user && user.status !== "DELETED" ? user.id : null, ctx, user ? (user.role === "ADMIN" ? "admin" : "noPassword") : "noAccount");
    return result;
  }

  const check = await attemptPassword(user, password, now);
  if (!check.ok) {
    await logFail(id, user.id, ctx, check.reason);
    if (check.reason === "wrong") return { ok: false, error: "invalid" };
    if (check.fresh) await audit({ actorId: user.id, action: "user.password.locked", entity: "User", entityId: user.id, meta: contextMeta(ctx) });
    return { ok: false, error: "locked", retryInSeconds: check.retryInSeconds };
  }
  if (user.status !== "ACTIVE") {
    await logFail(id, user.id, ctx, "blocked");
    return { ok: false, error: "blocked" };
  }
  if (user.role === "CASHIER" && !(await cashierBusiness(user.id))) {
    await logFail(id, user.id, ctx, "noBusiness");
    return { ok: false, error: "noBusiness" };
  }
  await recordLogin(user.id, id.kind, ctx);
  return { ok: true, userId: user.id, role: user.role, method: id.kind, mustSetPassword: user.passwordResetRequired };
}
