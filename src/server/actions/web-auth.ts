"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/format";
import {
  type Intent,
  loginWith,
  passwordInput,
  requestCode,
  setPasswordWith,
  signInWith,
  socialSignInWith,
  verifyCode,
  type VerifyResult,
} from "../api/auth-flow";
import { ApiError, type ApiErrorCode } from "../api/http";
import { limit } from "../api/rate-limit";
import { quickApplicationSchema, registerBusinessWith, registerStudentWith, studentRegisterSchema } from "../api/register";
import { clientIp } from "../auth/phone-check";
import { ADMIN_PASSWORD_PATH, createSession, homePathFor, requireRole } from "../auth/session";
import { effectiveStudentStatus, studentPathFor } from "../auth/student-status";
import { submitQuickBusiness } from "../business/quick-application";
import { db } from "../db";

/*
 * Sayt kirishi va ro'yxati (talaba, biznes): ilova (`/api/v1/auth/*`) bilan bir xil qoidalar — mantiq `api/auth-flow.ts` va
 * `api/register.ts` da, bu yerda faqat sessiya cookie'da ochiladi (`openSite`) va xatolar mijozga kod bilan qaytadi.
 * Qadamlar orasidagi holat — muhrlangan `ticket` (mijoz ichini o'qiy olmaydi), cookie emas.
 */

export type WebFailure = { ok: false; code: ApiErrorCode; retryInSeconds?: number; left?: number; fields?: string[] };
export type WebResult<T> = ({ ok: true } & T) | WebFailure;

const intentSchema = z.enum(["student", "business"]).catch("student");
const text = (max: number) => z.string().max(max).catch("");

function failure(error: unknown): WebFailure {
  if (!(error instanceof ApiError)) throw error;
  const { retryInSeconds, left, fields } = error.details;
  return {
    ok: false,
    code: error.code,
    retryInSeconds: typeof retryInSeconds === "number" ? retryInSeconds : undefined,
    left: typeof left === "number" ? left : undefined,
    fields: Array.isArray(fields) ? fields.map(String) : undefined,
  };
}

async function guard<T>(run: () => Promise<WebResult<T>>): Promise<WebResult<T>> {
  try {
    return await run();
  } catch (error) {
    return failure(error);
  }
}

async function openSite(userId: string): Promise<string> {
  await createSession(userId, (await headers()).get("user-agent"));
  return userId;
}

async function enter(userId: string): Promise<never> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, student: { select: { status: true, cardExpiresAt: true } } } });
  const href = user.student ? studentPathFor(effectiveStudentStatus(user.student.status, user.student.cardExpiresAt, new Date())) : homePathFor(user.role);
  return redirect({ href, locale: await getLocale() });
}

/** SMS kod yuborish (ro'yxat va "Parolni unutdim"). Raqam ro'yxatda bor-yo'qligi oshkor qilinmaydi. */
export async function webRequestCodeAction(phone: string): Promise<WebResult<{ phone: string; resendInSeconds: number }>> {
  return guard(async () => ({ ok: true, ...(await requestCode(text(32).parse(phone), await clientIp())) }));
}

/** Kodni tekshirish → keyingi qadam va ticket (hisob bor bo'lsa — parol, yo'q bo'lsa — parol o'rnatish). */
export async function webVerifyCodeAction(phone: string, code: string, intent: string): Promise<WebResult<{ result: VerifyResult }>> {
  return guard(async () => {
    await limit("verify", await clientIp());
    try {
      return { ok: true, result: await verifyCode(text(32).parse(phone), text(12).parse(code), intentSchema.parse(intent)) };
    } catch (error) {
      // Admin API orqali kirmaydi; saytda — avvalgidek: SMS kod to'g'ri bo'lsa (yuqorida tekshirilgan) sessiya ochiladi va
      // ikkinchi qadam — admin paroli (`/kirish/admin`, `requireRole` parolsiz admin sahifalarini ochmaydi).
      if (!(error instanceof ApiError) || error.code !== "admin_not_supported") throw error;
      const admin = await db.user.findUnique({ where: { phone: normalizePhone(text(32).parse(phone)) ?? "" }, select: { id: true, status: true } });
      if (admin?.status !== "ACTIVE") throw new ApiError("account_blocked");
      await openSite(admin.id);
      return redirect({ href: ADMIN_PASSWORD_PATH, locale: await getLocale() });
    }
  });
}

/** Telefon yoki email + parol (SMSsiz). Muvaffaqiyatda — sessiya va bosh sahifa. */
export async function webSignInAction(identifier: string, password: string): Promise<WebFailure> {
  const result = await guard(async () => {
    await limit("login", await clientIp());
    const userId = await signInWith(z.string().min(1).max(200).catch("-").parse(identifier), passwordInput.catch("").parse(password), openSite);
    return enter(userId);
  });
  return result as WebFailure;
}

/** Hisob bor va parolli (SMS tasdig'i yoki Google/Apple dan keyin): parol bilan kirish. */
export async function webLoginTicketAction(ticket: string, password: string): Promise<WebFailure> {
  const result = await guard(async () => {
    await limit("login", await clientIp());
    const userId = await loginWith(text(2000).parse(ticket), passwordInput.catch("").parse(password), openSite);
    return enter(userId);
  });
  return result as WebFailure;
}

export type SetPasswordNext = { registrationTicket: string; role: "student" | "business" | "cashier" };

/** Parol o'rnatish: yangi hisob — ma'lumotlar qadamiga (`registrationTicket`); "Parolni unutdim" — yangi parol va kirish. */
export async function webSetPasswordAction(ticket: string, password: string, confirm: string): Promise<WebResult<SetPasswordNext>> {
  return guard(async () => {
    await limit("password", await clientIp());
    const result = await setPasswordWith(text(2000).parse(ticket), passwordInput.catch("").parse(password), passwordInput.catch("").parse(confirm), openSite);
    if (result.next === "signedIn") return enter(result.opened);
    return { ok: true, registrationTicket: result.registrationTicket, role: result.role };
  });
}

export type SocialNext =
  | { next: "password"; ticket: string; masked: string; initial: string | null; role: Intent }
  | { next: "register"; registrationTicket: string; role: Intent; profile: { firstName: string | null; lastName: string | null; email: string | null } };

/** Google/Apple (brauzerda olingan ID token): kirish, parol so'rash yoki yangi hisob (ism oldindan to'ldiriladi). */
export async function webSocialAction(provider: string, idToken: string, intent: string, firstName?: string, lastName?: string): Promise<WebResult<{ result: SocialNext }>> {
  return guard(async () => {
    await limit("verify", await clientIp());
    const kind = provider === "APPLE" ? "APPLE" : "GOOGLE";
    const result = await socialSignInWith(kind, z.string().min(20).max(8000).catch("").parse(idToken), intentSchema.parse(intent), { firstName, lastName }, openSite);
    if (result.next === "signedIn") return enter(result.opened);
    return { ok: true, result };
  });
}

/** Talaba ma'lumotlari → hisob ochiladi, kirish, guvohnoma qadamiga. */
export async function webRegisterStudentAction(input: Omit<z.infer<typeof studentRegisterSchema>, "deviceName">): Promise<WebFailure> {
  const result = await guard(async () => {
    await limit("register", await clientIp());
    return enter(await registerStudentWith(studentRegisterSchema.parse(input), openSite));
  });
  return result as WebFailure;
}

/** Biznes arizasi: hisob ochiladi va kiriladi; rasm (ixtiyoriy) va `webSubmitBusinessAction` mijozda keyin. */
export async function webRegisterBusinessAction(ticket: string, input: z.infer<typeof quickApplicationSchema>): Promise<WebResult<object>> {
  return guard(async () => {
    await limit("register", await clientIp());
    await registerBusinessWith(text(2000).parse(ticket), quickApplicationSchema.parse(input), openSite);
    return { ok: true };
  });
}

/** Arizani tekshiruvga yuborish. */
export async function webSubmitBusinessAction(): Promise<WebResult<object>> {
  return guard(async () => {
    const user = await requireRole("BUSINESS_OWNER");
    if (!(await submitQuickBusiness(user.id)).ok) throw new ApiError("not_editable");
    return { ok: true };
  });
}
