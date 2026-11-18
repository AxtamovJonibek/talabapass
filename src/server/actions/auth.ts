"use server";

import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/format";
import { EMAIL_MAX } from "@/lib/identifier";
import { cleanPassword, isValidPassword, PASSWORD_MAX } from "@/lib/password";
import { isAppRequest } from "../app-mode";
import { limitWait } from "../api/rate-limit";
import { passwordFingerprint } from "../api/rules";
import { checkLogin, recordLogin } from "../auth/login";
import { requestOtp, verifyOtp } from "../auth/otp";
import { attemptPassword, hashPassword, savePassword, type AuthContext } from "../auth/password";
import { forgetPasswordStep, getPasswordStep, rememberPasswordStep, rememberPendingPassword } from "../auth/password-steps";
import { clientIp } from "../auth/phone-check";
import { requestPasswordReset, verifyPasswordReset } from "../auth/recovery";
import {
  ADMIN_PASSWORD_PATH,
  createSession,
  currentSessionId,
  destroySession,
  getCurrentUser,
  homePathFor,
  PASSWORD_SETUP_PATH,
  rememberVerifiedPhone,
} from "../auth/session";
import { effectiveStudentStatus, studentPathFor } from "../auth/student-status";
import { db } from "../db";

/*
 * Kirish va parol (sayt va Capacitor ilova bir xil action'lar):
 * - kirish — "Telefon raqam yoki email" + parol (`checkLogin`), SMSsiz;
 * - ro'yxat — telefon → SMS kod (faqat raqamni tasdiqlash) → parol → ma'lumotlar formasi;
 * - "Parolni unutdim" — raqam/email → SMS yoki email kodi → yangi parol (boshqa sessiyalar yopiladi);
 * - kirgan foydalanuvchi: parolsiz eski hisob yoki admin "tiklash" bosgan — `/kirish/parol`, profildan almashtirish ham shu.
 * Admin — o'z yo'li: `/kirish/admin` (SMS kod → umumiy admin paroli).
 */

export type AuthError =
  | "phone"
  | "tooSoon"
  | "dailyLimit"
  | "ipLimit"
  | "sms"
  | "wrongCode"
  | "expired"
  | "locked"
  | "blocked"
  | "noBusiness"
  | "identifier"
  | "invalid"
  | "loginLocked"
  | "exists"
  | "notAdmin"
  | "weakPassword"
  | "mismatch"
  | "stepExpired"
  | "wrongCurrent";
export type AuthFailure = { ok: false; error: AuthError; retryInSeconds?: number; left?: number };
export type RequestCodeResult = { ok: true; phone: string } | AuthFailure;
export type RegisterVerifyResult = { ok: true; mode: "new" | "missing" } | AuthFailure;
export type ForgotResult = { ok: true; channel: "sms" | "email" } | AuthFailure;

const SEND_ERRORS = { too_soon: "tooSoon", daily_limit: "dailyLimit", ip_limit: "ipLimit", locked: "locked" } as const;
const CODE_ERRORS = { locked: "locked", wrong: "wrongCode", expired: "expired", no_code: "expired" } as const;

const intentSchema = z.enum(["student", "business"]);
const identifierSchema = z.string().max(EMAIL_MAX + 8).catch("");
const passwordSchema = z.string().max(PASSWORD_MAX * 2).catch("");
const codeSchema = z.string().max(12).catch("");

async function context(): Promise<AuthContext> {
  return { via: (await isAppRequest()) ? "app" : "web", userAgent: (await headers()).get("user-agent") };
}

/** Kirgandan keyingi sahifa: talaba — holatiga qarab, qolganlar — rol bosh sahifasi; parol majburiy bo'lsa — parol. */
async function homeFor(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true, passwordResetRequired: true, student: { select: { status: true, cardExpiresAt: true } } },
  });
  if (user.passwordResetRequired) return PASSWORD_SETUP_PATH;
  return user.student ? studentPathFor(effectiveStudentStatus(user.student.status, user.student.cardExpiresAt, new Date())) : homePathFor(user.role);
}

async function signIn(userId: string): Promise<never> {
  await forgetPasswordStep();
  await createSession(userId, (await headers()).get("user-agent"));
  return redirect({ href: await homeFor(userId), locale: await getLocale() });
}

// ───────── kirish ─────────

/** Raqam/email + parol. Xato bo'lsa — bitta umumiy matn (hisob borligi bilinmaydi). Muvaffaqiyatda — yo'naltiriladi. */
export async function loginAction(rawIdentifier: string, rawPassword: string): Promise<AuthFailure> {
  const wait = await limitWait("login", await clientIp());
  if (wait !== null) return { ok: false, error: "ipLimit", retryInSeconds: wait };
  const result = await checkLogin(identifierSchema.parse(rawIdentifier), passwordSchema.parse(rawPassword), await context());
  if (!result.ok) {
    if (result.error === "locked") return { ok: false, error: "loginLocked", retryInSeconds: result.retryInSeconds };
    return { ok: false, error: result.error };
  }
  return signIn(result.userId);
}

// ───────── ro'yxat: telefon → SMS kod → parol ─────────

/** Raqamga SMS kod (ro'yxat va admin kirishi). Raqam ro'yxatda bor-yo'qligi oshkor qilinmaydi. */
export async function requestCodeAction(rawPhone: string): Promise<RequestCodeResult> {
  const phone = normalizePhone(z.string().max(32).catch("").parse(rawPhone));
  if (!phone) return { ok: false, error: "phone" };
  const t = await getTranslations("auth");
  try {
    const sent = await requestOtp(phone, await clientIp(), (code) => t("sms", { code }));
    if (!sent.ok) return { ok: false, error: SEND_ERRORS[sent.reason], retryInSeconds: Math.ceil(sent.retryInMs / 1000) };
  } catch (error) {
    console.error("SMS yuborilmadi:", error);
    return { ok: false, error: "sms" };
  }
  return { ok: true, phone };
}

/**
 * Ro'yxat kodi. Yangi raqam — parol qadami (keyin ma'lumotlar formasi). Raqam egasi isbotlandi, shuning uchun hisob
 * borligini aytish mumkin: paroli bor — "exists" (kirish), parolsiz eski hisob — shu yerda parol o'rnatadi.
 */
export async function registerVerifyAction(rawPhone: string, rawCode: string, rawIntent: string): Promise<RegisterVerifyResult> {
  const phone = normalizePhone(z.string().max(32).catch("").parse(rawPhone));
  const intent = intentSchema.catch("student").parse(rawIntent);
  if (!phone) return { ok: false, error: "phone" };
  const result = await verifyOtp(phone, codeSchema.parse(rawCode).replace(/\D/g, ""));
  if (result !== "ok") return { ok: false, error: CODE_ERRORS[result] };

  const user = await db.user.findUnique({ where: { phone }, select: { id: true, role: true, status: true, passwordHash: true } });
  if (!user) {
    // Ro'yxat formalari tasdiqlangan raqamga tayanadi (kod qayta so'ralmaydi)
    await rememberVerifiedPhone(phone);
    await rememberPasswordStep(phone, `new:${intent}`);
    return { ok: true, mode: "new" };
  }
  if (user.status !== "ACTIVE") return { ok: false, error: "blocked" };
  if (user.passwordHash || user.role === "ADMIN") return { ok: false, error: "exists" };
  await rememberPasswordStep(user.id, "set", passwordFingerprint(null));
  return { ok: true, mode: "missing" };
}

/** Kod bilan tasdiqlangan qadamdan keyin parol: yangi raqam (→ forma), parolsiz hisob yoki "Parolni unutdim" (→ ichkariga). */
export async function setPasswordAction(rawPassword: string, rawConfirm: string): Promise<AuthFailure> {
  const step = await getPasswordStep();
  if (!step) return { ok: false, error: "stepExpired" };
  const password = passwordSchema.parse(rawPassword);
  if (!isValidPassword(password)) return { ok: false, error: "weakPassword" };
  if (cleanPassword(password) !== cleanPassword(passwordSchema.parse(rawConfirm))) return { ok: false, error: "mismatch" };
  const hash = hashPassword(password);

  if (step.step === "new:student" || step.step === "new:business") {
    // Shu orada boshqa yo'l bilan hisob ochilgan bo'lsa — qaytadan
    if (await db.user.findUnique({ where: { phone: step.subject }, select: { id: true } })) return { ok: false, error: "stepExpired" };
    await rememberPendingPassword(step.subject, hash);
    await forgetPasswordStep();
    return redirect({ href: step.step === "new:business" ? "/biznes/royxat" : "/talaba/royxat", locale: await getLocale() });
  }

  const user = await db.user.findUnique({ where: { id: step.subject }, select: { id: true, status: true, passwordHash: true } });
  if (!user || user.status !== "ACTIVE" || passwordFingerprint(user.passwordHash) !== step.fp) return { ok: false, error: "stepExpired" };
  const ctx = await context();
  await savePassword(user.id, hash, step.step === "reset" ? "reset" : "set", ctx, { method: step.method });
  await recordLogin(user.id, step.method, ctx);
  return signIn(user.id);
}

// ───────── parolni unutdim ─────────

/** Javob hisobdan qat'i nazar bir xil (faqat IP chegarasi aytiladi). */
export async function forgotRequestAction(rawIdentifier: string): Promise<ForgotResult> {
  const wait = await limitWait("forgot", await clientIp());
  if (wait !== null) return { ok: false, error: "ipLimit", retryInSeconds: wait };
  const result = await requestPasswordReset(identifierSchema.parse(rawIdentifier), await clientIp());
  if (!result.ok) return { ok: false, error: result.error, ...(result.error === "ipLimit" ? { retryInSeconds: result.retryInSeconds } : {}) };
  return { ok: true, channel: result.channel };
}

export async function forgotVerifyAction(rawIdentifier: string, rawCode: string): Promise<{ ok: true } | AuthFailure> {
  const result = await verifyPasswordReset(identifierSchema.parse(rawIdentifier), codeSchema.parse(rawCode));
  if (!result.ok) return { ok: false, error: result.error };
  const user = await db.user.findUniqueOrThrow({ where: { id: result.userId }, select: { passwordHash: true } });
  await rememberPasswordStep(result.userId, "reset", passwordFingerprint(user.passwordHash), result.method);
  return { ok: true };
}

// ───────── kirgan foydalanuvchi: majburiy parol va almashtirish ─────────

/**
 * Parolsiz hisob yoki admin tiklashidan keyin — joriy parolsiz yangi parol; aks holda almashtirish (joriy parol bilan,
 * xatolar kirishdagi qulf hisobida). Boshqa qurilmalardagi sessiyalar yopiladi, shu qurilma ochiq qoladi.
 */
export async function ownPasswordAction(rawCurrent: string, rawPassword: string, rawConfirm: string): Promise<AuthFailure | { ok: true }> {
  const current = await getCurrentUser();
  const locale = await getLocale();
  if (!current) return redirect({ href: "/kirish", locale });
  if (current.role === "ADMIN") return redirect({ href: homePathFor(current.role), locale });
  const password = passwordSchema.parse(rawPassword);
  if (!isValidPassword(password)) return { ok: false, error: "weakPassword" };
  if (cleanPassword(password) !== cleanPassword(passwordSchema.parse(rawConfirm))) return { ok: false, error: "mismatch" };

  const forced = !current.passwordHash || current.passwordResetRequired;
  if (!forced) {
    const check = await attemptPassword(current, passwordSchema.parse(rawCurrent));
    if (!check.ok) {
      if (check.reason === "wrong") return { ok: false, error: "wrongCurrent", left: check.left };
      return { ok: false, error: "loginLocked", retryInSeconds: check.retryInSeconds };
    }
  }
  const keep = await currentSessionId();
  await savePassword(current.id, hashPassword(password), current.passwordHash ? "change" : "set", await context(), {
    keepSessionId: keep ?? undefined,
    closeOthers: true,
  });
  if (forced) return redirect({ href: await homeFor(current.id), locale });
  return { ok: true };
}

// ───────── admin: SMS kod → umumiy admin paroli ─────────

/** Faqat admin hisobi uchun sessiya ochadi (raqam egasi kod bilan isbotlangan — "admin emas" deyish mumkin). */
export async function adminVerifyCodeAction(rawPhone: string, rawCode: string): Promise<AuthFailure> {
  const phone = normalizePhone(z.string().max(32).catch("").parse(rawPhone));
  if (!phone) return { ok: false, error: "phone" };
  const result = await verifyOtp(phone, codeSchema.parse(rawCode).replace(/\D/g, ""));
  if (result !== "ok") return { ok: false, error: CODE_ERRORS[result] };
  const user = await db.user.findUnique({ where: { phone }, select: { id: true, role: true, status: true } });
  if (!user || user.role !== "ADMIN") return { ok: false, error: "notAdmin" };
  if (user.status !== "ACTIVE") return { ok: false, error: "blocked" };
  await createSession(user.id, (await headers()).get("user-agent"));
  await recordLogin(user.id, "phone", await context());
  return redirect({ href: ADMIN_PASSWORD_PATH, locale: await getLocale() });
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  // Ilovada — kirish ekrani, saytda — bosh sahifa
  redirect({ href: (await isAppRequest()) ? "/kirish" : "/", locale: await getLocale() });
}
