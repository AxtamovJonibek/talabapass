"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/format";
import { cleanPassword, isValidPassword, maskPhone, PASSWORD_MAX } from "@/lib/password";
import { audit } from "../audit";
import { verifyOtp } from "../auth/otp";
import {
  attemptPassword,
  forgetPasswordStep,
  getPasswordStep,
  hashPassword,
  rememberPasswordStep,
  rememberPendingPassword,
} from "../auth/password";
import { ADMIN_PASSWORD_PATH, createSession, homePathFor, rememberVerifiedPhone, revokeUserSessions } from "../auth/session";
import { effectiveStudentStatus, studentPathFor } from "../auth/student-status";
import { cashierBusiness } from "../business/cashiers";
import { db } from "../db";
import type { AuthError } from "./auth";

/*
 * Ilova kirishi (design/app-flow): telefon → SMS kod → parol. Kod so'rash — mavjud `requestCodeAction`
 * (raqam ro'yxatda bor-yo'qligi oshkor qilinmaydi). Sayt kirishi (`verifyCodeAction`) o'zgarmagan — parolsiz.
 */

export type PasswordError = "wrongPassword" | "passwordLocked" | "weakPassword" | "mismatch" | "stepExpired";
export type AppVerifyResult =
  | { ok: false; error: AuthError }
  /** Hisob bor, parol o'rnatilgan — Kirish ekrani */
  | { ok: true; next: "password"; masked: string; initial: string | null; role: "student" | "business" }
  /** Yangi raqam yoki parolsiz eski hisob — Parol ekrani */
  | { ok: true; next: "setPassword"; isNew: boolean; role: "student" | "business" };
export type PasswordResult = { ok: false; error: PasswordError; left?: number; retryInSeconds?: number };

const intentSchema = z.enum(["student", "business"]);
const passwordSchema = z.string().max(PASSWORD_MAX * 2).catch("");

async function homeFor(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, student: { select: { status: true, cardExpiresAt: true } } } });
  return user.student ? studentPathFor(effectiveStudentStatus(user.student.status, user.student.cardExpiresAt, new Date())) : homePathFor(user.role);
}

async function signIn(userId: string): Promise<never> {
  await forgetPasswordStep();
  await createSession(userId, (await headers()).get("user-agent"));
  return redirect({ href: await homeFor(userId), locale: await getLocale() });
}

/** SMS kodni tekshiradi va keyingi qadamni aytadi (sessiya hali ochilmaydi — admin bundan mustasno). */
export async function appVerifyCodeAction(rawPhone: string, rawCode: string, rawIntent: string): Promise<AppVerifyResult> {
  const phone = normalizePhone(z.string().max(32).catch("").parse(rawPhone));
  const code = z.string().max(12).catch("").parse(rawCode).replace(/\D/g, "");
  const intent = intentSchema.catch("student").parse(rawIntent);
  if (!phone) return { ok: false, error: "phone" };

  const result = await verifyOtp(phone, code);
  if (result !== "ok") return { ok: false, error: result === "locked" ? "locked" : result === "wrong" ? "wrongCode" : "expired" };

  const user = await db.user.findUnique({ where: { phone }, select: { id: true, role: true, status: true, firstName: true, passwordHash: true } });
  if (!user) {
    // Ro'yxat formalari tasdiqlangan raqamga tayanadi (kod qayta so'ralmaydi)
    await rememberVerifiedPhone(phone);
    await rememberPasswordStep(phone, `new:${intent}`);
    return { ok: true, next: "setPassword", isNew: true, role: intent };
  }
  if (user.status !== "ACTIVE") return { ok: false, error: "blocked" };
  if (user.role === "CASHIER" && !(await cashierBusiness(user.id))) return { ok: false, error: "noBusiness" };
  if (user.role === "ADMIN") {
    // Admin — o'z ikkinchi qadami (umumiy admin paroli, /kirish/admin)
    await createSession(user.id, (await headers()).get("user-agent"));
    return redirect({ href: ADMIN_PASSWORD_PATH, locale: await getLocale() });
  }
  if (user.passwordHash) {
    await rememberPasswordStep(phone, "login");
    return { ok: true, next: "password", masked: maskPhone(phone), initial: user.firstName?.trim().charAt(0).toUpperCase() || null, role: user.role === "STUDENT" ? "student" : "business" };
  }
  await rememberPasswordStep(phone, "set");
  return { ok: true, next: "setPassword", isNew: false, role: user.role === "STUDENT" ? "student" : "business" };
}

/** Kirish (parol). Muvaffaqiyatda — sessiya va bosh sahifa. */
export async function appLoginAction(rawPassword: string): Promise<PasswordResult> {
  const step = await getPasswordStep();
  if (!step || step.step !== "login") return { ok: false, error: "stepExpired" };
  const user = await db.user.findUnique({ where: { phone: step.phone }, select: { id: true, status: true, passwordHash: true, passwordLockedUntil: true } });
  if (!user || user.status !== "ACTIVE" || !user.passwordHash) return { ok: false, error: "stepExpired" };

  const check = await attemptPassword(user, passwordSchema.parse(rawPassword));
  if (!check.ok) {
    if (check.reason === "wrong") return { ok: false, error: "wrongPassword", left: check.left };
    // Qulf: SMS tasdig'i ham bekor — qayta urinish yangi kod bilan
    await forgetPasswordStep();
    await audit({ actorId: user.id, action: "user.password.locked", entity: "User", entityId: user.id });
    return { ok: false, error: "passwordLocked", retryInSeconds: check.retryInSeconds };
  }
  return signIn(user.id);
}

/**
 * Parol o'rnatish: yangi raqam (keyin ro'yxat formasi), parolsiz eski hisob yoki "Parolni unutdim"
 * (SMS tasdig'i hali amal qilsa; boshqa qurilmalardagi sessiyalar yopiladi).
 */
export async function appSetPasswordAction(rawPassword: string, rawConfirm: string): Promise<PasswordResult> {
  const step = await getPasswordStep();
  if (!step) return { ok: false, error: "stepExpired" };
  const password = passwordSchema.parse(rawPassword);
  if (!isValidPassword(password)) return { ok: false, error: "weakPassword" };
  if (cleanPassword(password) !== cleanPassword(passwordSchema.parse(rawConfirm))) return { ok: false, error: "mismatch" };
  const hash = hashPassword(password);
  const locale = await getLocale();

  const user = await db.user.findUnique({ where: { phone: step.phone }, select: { id: true, status: true } });
  if (step.step === "new:student" || step.step === "new:business") {
    // Shu orada boshqa yo'l bilan hisob ochilgan bo'lsa — qaytadan kirish
    if (user) return { ok: false, error: "stepExpired" };
    await rememberPendingPassword(step.phone, hash);
    await forgetPasswordStep();
    return redirect({ href: step.step === "new:business" ? "/biznes/royxat" : "/talaba/royxat", locale });
  }

  if (!user || user.status !== "ACTIVE") return { ok: false, error: "stepExpired" };
  const reset = step.step === "login";
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hash, passwordFails: 0, passwordLockedUntil: null } });
  if (reset) await revokeUserSessions(user.id);
  await audit({ actorId: user.id, action: reset ? "user.password.reset" : "user.password.set", entity: "User", entityId: user.id });
  return signIn(user.id);
}
