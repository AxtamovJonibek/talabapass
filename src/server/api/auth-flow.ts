import "server-only";
import { createTranslator } from "next-intl";
import { z } from "zod";
import messages from "../../../messages/uz.json";
import { normalizePhone } from "@/lib/format";
import { cleanPassword, isValidPassword, maskPhone, PASSWORD_MAX } from "@/lib/password";
import { audit } from "../audit";
import { requestOtp, verifyOtp } from "../auth/otp";
import { attemptPassword, hashPassword } from "../auth/password";
import { acceptPhoneInvite, cashierBusiness, phoneInvite } from "../business/cashiers";
import { db } from "../db";
import { authSecret } from "../env";
import { ApiError, type ApiErrorCode } from "./http";
import { passwordFingerprint, seal, unseal } from "./rules";
import { loadApiUser, meView, openApiSession, type Device, type MeView, type TokenPair } from "./session";

/*
 * Ilova kirishi API orqali — sayt ilova oqimi (`actions/app-auth.ts`) bilan bir xil qoidalar: telefon → SMS kod → parol.
 * Raqam ro'yxatda bor-yo'qligi faqat kod to'g'ri kiritilgandan keyin bilinadi. Qadamlar orasidagi holat cookie o'rniga
 * muhrlangan tokenlarda (mijoz faqat qaytarib yuboradi, ichini o'qiy olmaydi):
 * - `step` (10 daqiqa): tasdiqlangan raqam, keyingi qadam (`login` | `set` | `new:student|business`) va parol xeshining
 *   izi — parol o'zgarsa eski qadam tokeni ishlamaydi;
 * - `register` (30 daqiqa): yangi raqam va o'rnatilgan parol xeshi — ro'yxat endpoint'i hisobni shu bilan ochadi.
 * Admin API orqali kirmaydi (ikkinchi qadam — sayt).
 */

export const STEP_TTL_MS = 10 * 60_000;
export const REGISTER_TTL_MS = 30 * 60_000;

type Step = "login" | "set" | "new:student" | "new:business" | "new:cashier";
export type Intent = "student" | "business";
/** Ro'yxat turi: kassir — telefon raqamiga taklif bo'lsa (biznes egasi ilovada qo'shgan) */
export type NewRole = Intent | "cashier";
export type SignedIn = { tokens: TokenPair; user: MeView };

const SEND_ERRORS = { too_soon: "too_soon", daily_limit: "daily_limit", ip_limit: "ip_limit", locked: "code_locked" } as const;
const VERIFY_ERRORS: Record<"no_code" | "expired" | "locked" | "wrong", ApiErrorCode> = {
  no_code: "code_expired",
  expired: "code_expired",
  locked: "code_locked",
  wrong: "wrong_code",
};

const smsText = createTranslator({ locale: "uz", messages, namespace: "auth" });

export const passwordInput = z.string().max(PASSWORD_MAX * 2);

function phoneOrThrow(raw: string): string {
  const phone = normalizePhone(raw);
  if (!phone) throw new ApiError("invalid_phone");
  return phone;
}

// ───────── qadam tokenlari ─────────

function stepToken(phone: string, step: Step, passwordHash: string | null): string {
  return seal("step", { phone, step, fp: passwordFingerprint(passwordHash) }, STEP_TTL_MS, authSecret());
}

function openStep(token: string): { phone: string; step: Step; fp: string } {
  const data = unseal("step", token, authSecret());
  if (!data || data.exp <= Date.now() || typeof data.phone !== "string" || typeof data.step !== "string" || typeof data.fp !== "string") {
    throw new ApiError("step_expired");
  }
  return { phone: data.phone, step: data.step as Step, fp: data.fp };
}

export function openRegisterTicket(token: string, role: NewRole): { phone: string; passwordHash: string } {
  const data = unseal("register", token, authSecret());
  if (!data || data.exp <= Date.now() || data.role !== role || typeof data.phone !== "string" || typeof data.hash !== "string") {
    throw new ApiError("step_expired");
  }
  return { phone: data.phone, passwordHash: data.hash };
}

// ───────── 1. kod so'rash ─────────

/** SMS kod yuboradi. Raqam ro'yxatda bor-yo'qligi oshkor qilinmaydi (javob bir xil). */
export async function requestCode(rawPhone: string, ip: string): Promise<{ phone: string; resendInSeconds: number }> {
  const phone = phoneOrThrow(rawPhone);
  let sent;
  try {
    sent = await requestOtp(phone, ip, (code) => smsText("sms", { code }));
  } catch (error) {
    console.error("SMS yuborilmadi:", error);
    throw new ApiError("sms_failed");
  }
  if (!sent.ok) throw new ApiError(SEND_ERRORS[sent.reason], { retryInSeconds: Math.ceil(sent.retryInMs / 1000) });
  return { phone, resendInSeconds: 60 };
}

// ───────── 2. kodni tekshirish ─────────

export type VerifyResult =
  /** Hisob bor, parol o'rnatilgan — parol bilan kirish */
  | { next: "password"; ticket: string; role: Intent; masked: string; initial: string | null }
  /** Yangi raqam (keyin ro'yxat) yoki parolsiz eski hisob; `cashier` — yangi raqamga kassir taklifi bor (`business` niyatida) */
  | { next: "setPassword"; ticket: string; role: NewRole; isNew: boolean; businessName?: string };

export async function verifyCode(rawPhone: string, rawCode: string, intent: Intent): Promise<VerifyResult> {
  const phone = phoneOrThrow(rawPhone);
  const result = await verifyOtp(phone, rawCode.replace(/\D/g, ""));
  if (result !== "ok") throw new ApiError(VERIFY_ERRORS[result]);

  const user = await db.user.findUnique({ where: { phone }, select: { id: true, role: true, status: true, firstName: true, passwordHash: true } });
  if (!user) {
    const invite = intent === "business" ? await phoneInvite(phone) : null;
    if (invite) return { next: "setPassword", ticket: stepToken(phone, "new:cashier", null), role: "cashier", isNew: true, businessName: invite.business.name };
    return { next: "setPassword", ticket: stepToken(phone, `new:${intent}`, null), role: intent, isNew: true };
  }
  if (user.status !== "ACTIVE") throw new ApiError("account_blocked");
  if (user.role === "ADMIN") throw new ApiError("admin_not_supported");
  // Avvalgi biznesdan chiqarilgan kassir: yangi biznesdan shu raqamga taklif bo'lsa — SMS tasdig'i bilan qabul qilinadi
  if (user.role === "CASHIER" && !(await cashierBusiness(user.id)) && !(await acceptPhoneInvite(phone, null)).ok) throw new ApiError("no_business");

  const role: Intent = user.role === "STUDENT" ? "student" : "business";
  if (user.passwordHash) {
    return {
      next: "password",
      ticket: stepToken(phone, "login", user.passwordHash),
      role,
      masked: maskPhone(phone),
      initial: user.firstName?.trim().charAt(0).toUpperCase() || null,
    };
  }
  return { next: "setPassword", ticket: stepToken(phone, "set", null), role, isNew: false };
}

// ───────── 3a. parol bilan kirish ─────────

/** Qadam tokeni egasining hisobi (faol, admin emas, qadam paytidagi parol bilan). */
async function stepUser(step: { phone: string; fp: string }) {
  const user = await db.user.findUnique({
    where: { phone: step.phone },
    select: { id: true, role: true, status: true, passwordHash: true, passwordLockedUntil: true },
  });
  if (!user || user.role === "ADMIN" || passwordFingerprint(user.passwordHash) !== step.fp) throw new ApiError("step_expired");
  if (user.status !== "ACTIVE") throw new ApiError("account_blocked");
  if (user.role === "CASHIER" && !(await cashierBusiness(user.id))) throw new ApiError("no_business");
  return user;
}

async function signedIn(userId: string, device: Device): Promise<SignedIn> {
  const tokens = await openApiSession(userId, device);
  return { tokens, user: meView(await loadApiUser(userId)) };
}

export async function loginWithPassword(ticket: string, password: string, device: Device): Promise<SignedIn> {
  const step = openStep(ticket);
  if (step.step !== "login") throw new ApiError("step_expired");
  const user = await stepUser(step);

  const check = await attemptPassword(user, password);
  if (!check.ok) {
    if (check.reason === "wrong") throw new ApiError("wrong_password", { left: check.left });
    await audit({ actorId: user.id, action: "user.password.locked", entity: "User", entityId: user.id, meta: { via: "api" } });
    throw new ApiError("password_locked", { retryInSeconds: check.retryInSeconds });
  }
  return signedIn(user.id, device);
}

// ───────── 3b. parol o'rnatish / tiklash ─────────

export type SetPasswordResult = ({ next: "signedIn" } & SignedIn) | { next: "register"; registrationTicket: string; role: NewRole };

/**
 * Yangi raqam — ro'yxat tokeni (hisob ro'yxat endpoint'ida ochiladi); parolsiz eski hisob — parol o'rnatiladi;
 * `login` qadami ("Parolni unutdim", SMS tasdig'i hali amal qilsa) — yangi parol, boshqa barcha sessiyalar yopiladi.
 */
export async function setPassword(ticket: string, password: string, confirm: string, device: Device): Promise<SetPasswordResult> {
  const step = openStep(ticket);
  if (!isValidPassword(password)) throw new ApiError("weak_password");
  if (cleanPassword(password) !== cleanPassword(confirm)) throw new ApiError("password_mismatch");
  const hash = hashPassword(password);

  if (step.step === "new:student" || step.step === "new:business" || step.step === "new:cashier") {
    // Shu orada boshqa yo'l bilan hisob ochilgan bo'lsa — qaytadan kirish
    if (await db.user.findUnique({ where: { phone: step.phone }, select: { id: true } })) throw new ApiError("step_expired");
    const role = step.step.slice(4) as NewRole;
    return { next: "register", role, registrationTicket: seal("register", { phone: step.phone, role, hash }, REGISTER_TTL_MS, authSecret()) };
  }

  const user = await stepUser(step);
  const reset = step.step === "login";
  // Shartli: parallel ikki so'rovdan faqat bittasi (xesh qadam paytidagidek bo'lsa) yozadi
  const updated = await db.user.updateMany({
    where: { id: user.id, passwordHash: user.passwordHash },
    data: { passwordHash: hash, passwordFails: 0, passwordLockedUntil: null },
  });
  if (updated.count !== 1) throw new ApiError("step_expired");
  // "Parolni unutdim": barcha qurilmalar (sayt va ilova) chiqariladi — `revokeUserSessions` bilan bir xil
  if (reset) await db.session.deleteMany({ where: { userId: user.id } });
  await audit({ actorId: user.id, action: reset ? "user.password.reset" : "user.password.set", entity: "User", entityId: user.id, meta: { via: "api" } });
  return { next: "signedIn", ...(await signedIn(user.id, device)) };
}
