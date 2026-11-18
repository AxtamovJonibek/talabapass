import "server-only";
import { createTranslator } from "next-intl";
import { z } from "zod";
import messages from "../../../messages/uz.json";
import { normalizePhone } from "@/lib/format";
import { cleanPassword, isValidPassword, PASSWORD_MAX } from "@/lib/password";
import { audit } from "../audit";
import { checkLogin, recordLogin } from "../auth/login";
import type { SocialAccount } from "../auth/new-account";
import { requestOtp, verifyOtp } from "../auth/otp";
import { hashPassword, savePassword, type AuthContext } from "../auth/password";
import { requestPasswordReset, verifyPasswordReset } from "../auth/recovery";
import { cashierBusiness, phoneInvite } from "../business/cashiers";
import { db } from "../db";
import { authSecret } from "../env";
import { ApiError, type ApiErrorCode } from "./http";
import { passwordFingerprint, seal, unseal } from "./rules";
import { SocialTokenError, verifySocialToken, type SocialProvider } from "./social-token";
import { loadApiUser, meView, openApiSession, type Device, type MeView, type TokenPair } from "./session";

/*
 * Ilova kirishi API orqali — sayt bilan bir xil qoidalar (`actions/auth.ts`):
 * - kirish: `{ identifier, password }` (telefon yoki email), SMSsiz; xato — bitta umumiy `invalid_credentials`;
 * - ro'yxat: telefon → SMS kod (`/auth/code`, `/auth/verify`) → parol (`/auth/password`) → ro'yxat endpoint'i;
 *   Google/Apple yangi foydalanuvchisi ham avval parol o'rnatadi (`setPassword` qadami), keyin ro'yxat;
 * - "Parolni unutdim": `/auth/forgot` → `/auth/forgot/verify` → `/auth/password` (boshqa sessiyalar yopiladi).
 * Qadamlar orasidagi holat muhrlangan tokenlarda (mijoz faqat qaytarib yuboradi, ichini o'qiy olmaydi):
 * - `step` (10 daqiqa): subyekt (yangi raqam, Google/Apple identifikatori yoki foydalanuvchi id), keyingi qadam va
 *   parol xeshining izi — parol o'zgarsa eski qadam tokeni ishlamaydi;
 * - `register` (30 daqiqa): raqam yoki identifikator va o'rnatilgan parol xeshi — ro'yxat endpoint'i hisobni shu bilan ochadi.
 * Admin API orqali kirmaydi (ikkinchi qadam — sayt).
 */

export const STEP_TTL_MS = 10 * 60_000;
export const REGISTER_TTL_MS = 30 * 60_000;

type Step = "set" | "reset" | "new:student" | "new:business" | "new:cashier";
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

const apiContext = (device: Device): AuthContext => ({ via: "api", deviceName: device.deviceName, userAgent: device.userAgent });

function phoneOrThrow(raw: string): string {
  const phone = normalizePhone(raw);
  if (!phone) throw new ApiError("invalid_phone");
  return phone;
}

// ───────── qadam tokenlari ─────────

type StepData = { step: Step; fp: string; phone?: string; userId?: string; social?: SocialAccount; method?: "phone" | "email" };

function stepToken(data: Omit<StepData, "fp">, passwordHash: string | null = null): string {
  return seal("step", { ...data, fp: passwordFingerprint(passwordHash) }, STEP_TTL_MS, authSecret());
}

const isSocial = (v: unknown): v is SocialAccount => {
  const s = v as Partial<SocialAccount> | undefined;
  return Boolean(s && (s.provider === "GOOGLE" || s.provider === "APPLE") && typeof s.subject === "string" && (s.email === null || typeof s.email === "string"));
};

function openStep(token: string): StepData {
  const data = unseal("step", token, authSecret());
  if (!data || data.exp <= Date.now() || typeof data.step !== "string" || typeof data.fp !== "string") throw new ApiError("step_expired");
  return {
    step: data.step as Step,
    fp: data.fp,
    phone: typeof data.phone === "string" ? data.phone : undefined,
    userId: typeof data.userId === "string" ? data.userId : undefined,
    social: isSocial(data.social) ? data.social : undefined,
    method: data.method === "email" ? "email" : "phone",
  };
}

/** Ro'yxat tokeni ichidagi hisob: telefon yoki Google/Apple identifikatori + parol xeshi (parolsiz hisob ochilmaydi). */
export type RegisterTicket = { account: string | SocialAccount; passwordHash: string };

export function openRegisterTicket(token: string, role: NewRole): RegisterTicket {
  const data = unseal("register", token, authSecret());
  if (!data || data.exp <= Date.now() || data.role !== role || typeof data.hash !== "string") throw new ApiError("step_expired");
  if (typeof data.phone === "string") return { account: data.phone, passwordHash: data.hash };
  if (isSocial(data.social)) return { account: data.social, passwordHash: data.hash };
  throw new ApiError("step_expired");
}

// ───────── kirish (SMSsiz) ─────────

export async function loginWithIdentifier(identifier: string, password: string, device: Device): Promise<SignedIn> {
  const result = await checkLogin(identifier, password, apiContext(device));
  if (!result.ok) {
    if (result.error === "locked") throw new ApiError("password_locked", { retryInSeconds: result.retryInSeconds });
    if (result.error === "blocked") throw new ApiError("account_blocked");
    if (result.error === "noBusiness") throw new ApiError("no_business");
    throw new ApiError("invalid_credentials");
  }
  return signedIn(result.userId, device);
}

async function signedIn(userId: string, device: Device): Promise<SignedIn> {
  const tokens = await openApiSession(userId, device);
  return { tokens, user: meView(await loadApiUser(userId)) };
}

// ───────── ro'yxat: 1. kod so'rash ─────────

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

// ───────── ro'yxat: 2. kodni tekshirish ─────────

export type VerifyResult =
  /** Yangi raqam (keyin ro'yxat) yoki parolsiz eski hisob; `cashier` — yangi raqamga kassir taklifi bor (`business` niyatida) */
  { next: "setPassword"; ticket: string; role: NewRole; isNew: boolean; businessName?: string };

/**
 * Raqam egasi kod bilan isbotlangandan keyin hisob borligini aytish mumkin: paroli bor hisob — `account_exists`
 * (parol bilan kirsin yoki tiklasin), parolsiz eski hisob — parol o'rnatish qadami.
 */
export async function verifyCode(rawPhone: string, rawCode: string, intent: Intent): Promise<VerifyResult> {
  const phone = phoneOrThrow(rawPhone);
  const result = await verifyOtp(phone, rawCode.replace(/\D/g, ""));
  if (result !== "ok") throw new ApiError(VERIFY_ERRORS[result]);

  const user = await db.user.findUnique({ where: { phone }, select: { id: true, role: true, status: true, passwordHash: true } });
  if (!user) {
    const invite = intent === "business" ? await phoneInvite(phone) : null;
    if (invite) return { next: "setPassword", ticket: stepToken({ step: "new:cashier", phone }), role: "cashier", isNew: true, businessName: invite.business.name };
    return { next: "setPassword", ticket: stepToken({ step: `new:${intent}`, phone }), role: intent, isNew: true };
  }
  if (user.status !== "ACTIVE") throw new ApiError("account_blocked");
  if (user.role === "ADMIN") throw new ApiError("admin_not_supported");
  if (user.passwordHash) throw new ApiError("account_exists");
  const role: Intent = user.role === "STUDENT" ? "student" : "business";
  return { next: "setPassword", ticket: stepToken({ step: "set", userId: user.id }), role, isNew: false };
}

// ───────── parolni unutdim ─────────

/** Javob hisobdan qat'i nazar bir xil (faqat IP chegarasi aytiladi). */
export async function requestForgot(identifier: string, ip: string): Promise<{ channel: "sms" | "email"; resendInSeconds: number }> {
  const result = await requestPasswordReset(identifier, ip);
  if (!result.ok) {
    if (result.error === "identifier") throw new ApiError("invalid_identifier");
    throw new ApiError("ip_limit", { retryInSeconds: result.retryInSeconds });
  }
  return { channel: result.channel, resendInSeconds: result.resendInSeconds };
}

export async function verifyForgot(identifier: string, code: string): Promise<{ next: "setPassword"; ticket: string }> {
  const result = await verifyPasswordReset(identifier, code);
  if (!result.ok) {
    if (result.error === "identifier") throw new ApiError("invalid_identifier");
    throw new ApiError(result.error === "locked" ? "code_locked" : result.error === "wrongCode" ? "wrong_code" : "code_expired");
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: result.userId }, select: { passwordHash: true } });
  return { next: "setPassword", ticket: stepToken({ step: "reset", userId: result.userId, method: result.method }, user.passwordHash) };
}

// ───────── parol o'rnatish / tiklash ─────────

export type SetPasswordResult = ({ next: "signedIn" } & SignedIn) | { next: "register"; registrationTicket: string; role: NewRole };

/** Qadam tokeni egasining hisobi (faol, admin emas, qadam paytidagi parol bilan). */
async function stepUser(step: StepData) {
  const user = step.userId ? await db.user.findUnique({ where: { id: step.userId }, select: { id: true, role: true, status: true, passwordHash: true } }) : null;
  if (!user || user.role === "ADMIN" || passwordFingerprint(user.passwordHash) !== step.fp) throw new ApiError("step_expired");
  if (user.status !== "ACTIVE") throw new ApiError("account_blocked");
  if (user.role === "CASHIER" && !(await cashierBusiness(user.id))) throw new ApiError("no_business");
  return user;
}

/**
 * Yangi raqam yoki Google/Apple — ro'yxat tokeni (hisob ro'yxat endpoint'ida, parol bilan birga ochiladi); parolsiz eski
 * hisob — parol o'rnatiladi; `reset` — yangi parol, boshqa barcha sessiyalar (sayt va ilova) yopiladi.
 */
export async function setPassword(ticket: string, password: string, confirm: string, device: Device): Promise<SetPasswordResult> {
  const step = openStep(ticket);
  if (!isValidPassword(password)) throw new ApiError("weak_password");
  if (cleanPassword(password) !== cleanPassword(confirm)) throw new ApiError("password_mismatch");
  const hash = hashPassword(password);

  if (step.step === "new:student" || step.step === "new:business" || step.step === "new:cashier") {
    const role = step.step.slice(4) as NewRole;
    if (step.social) {
      return { next: "register", role, registrationTicket: seal("register", { social: step.social, role, hash }, REGISTER_TTL_MS, authSecret()) };
    }
    if (!step.phone) throw new ApiError("step_expired");
    // Shu orada boshqa yo'l bilan hisob ochilgan bo'lsa — qaytadan
    if (await db.user.findUnique({ where: { phone: step.phone }, select: { id: true } })) throw new ApiError("step_expired");
    return { next: "register", role, registrationTicket: seal("register", { phone: step.phone, role, hash }, REGISTER_TTL_MS, authSecret()) };
  }

  const user = await stepUser(step);
  // Shartli: parallel ikki so'rovdan faqat bittasi (xesh qadam paytidagidek bo'lsa) yozadi
  const claimed = await db.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash }, data: { passwordHash: hash } });
  if (claimed.count !== 1) throw new ApiError("step_expired");
  const reset = step.step === "reset";
  await savePassword(user.id, hash, reset ? "reset" : "set", apiContext(device), { method: step.method });
  await recordLogin(user.id, step.method ?? "phone", apiContext(device));
  return { next: "signedIn", ...(await signedIn(user.id, device)) };
}

// ───────── Google / Apple (faqat ilova) ─────────

export type SocialResult =
  | ({ next: "signedIn" } & SignedIn)
  /** Yangi foydalanuvchi: avval parol (`/auth/password` shu ticket bilan), keyin ro'yxat; `profile` — formani oldindan to'ldirish uchun */
  | { next: "setPassword"; role: Intent; ticket: string; profile: { firstName: string | null; lastName: string | null; email: string | null } };

const SOCIAL_ERRORS = { unconfigured: "social_unavailable", invalid: "social_invalid", unreachable: "social_unreachable" } as const;

/** ID token → profil; xatolar API kodlariga (`social_unavailable` 503 — client ID sozlanmagan). */
export async function verifySocial(provider: SocialProvider, idToken: string) {
  try {
    return await verifySocialToken(provider, idToken);
  } catch (error) {
    if (error instanceof SocialTokenError) throw new ApiError(SOCIAL_ERRORS[error.reason]);
    throw error;
  }
}

const SOCIAL_USER = { id: true, role: true, status: true } as const;

/** Telefon oqimidagi tekshiruvlar: bloklangan/o'chirilgan, admin, biznessiz kassir. */
async function assertUsable(user: { id: string; role: string; status: string }) {
  if (user.status !== "ACTIVE") throw new ApiError("account_blocked");
  if (user.role === "ADMIN") throw new ApiError("admin_not_supported");
  if (user.role === "CASHIER" && !(await cashierBusiness(user.id))) throw new ApiError("no_business");
}

const nameOf = (v: string | undefined) => v?.trim().slice(0, 80) || null;

/**
 * Google/Apple bilan kirish. Identifikator (`provider` + `sub`) topilsa — kirish (parolsiz eski hisob — ichkarida parol
 * so'raladi, `password_setup_required`). Topilmasa, lekin provayder tasdiqlagan email boshqa hisobda bo'lsa — shu hisobga
 * bog'lanadi (bir xil email = bitta hisob). Aks holda — parol qadami (10 daq), keyin ro'yxat; ism Google tokenidan
 * (Apple — mijoz yuborgani: Apple ismni faqat birinchi ruxsatda, ilovaga beradi).
 */
export async function socialSignIn(
  provider: SocialProvider,
  idToken: string,
  intent: Intent,
  names: { firstName?: string; lastName?: string },
  device: Device,
): Promise<SocialResult> {
  const profile = await verifySocial(provider, idToken);
  const identity = await db.authIdentity.findUnique({
    where: { provider_subject: { provider, subject: profile.subject } },
    select: { id: true, user: { select: SOCIAL_USER } },
  });

  let user = identity?.user ?? null;
  if (identity) {
    await db.authIdentity.update({ where: { id: identity.id }, data: { lastUsedAt: new Date(), ...(profile.emailVerified ? { email: profile.email } : {}) } });
  } else if (profile.emailVerified && profile.email) {
    const byEmail = await db.user.findUnique({ where: { email: profile.email }, select: SOCIAL_USER });
    if (byEmail) {
      await assertUsable(byEmail);
      await db.authIdentity.upsert({
        where: { provider_subject: { provider, subject: profile.subject } },
        create: { provider, subject: profile.subject, email: profile.email, userId: byEmail.id, lastUsedAt: new Date() },
        update: {},
      });
      await audit({ actorId: byEmail.id, action: "user.identity.link", entity: "User", entityId: byEmail.id, meta: { provider, via: "email" } });
      user = byEmail;
    }
  }

  if (user) {
    await assertUsable(user);
    await recordLogin(user.id, provider === "GOOGLE" ? "google" : "apple", apiContext(device));
    return { next: "signedIn", ...(await signedIn(user.id, device)) };
  }

  const account: SocialAccount = { provider, subject: profile.subject, email: profile.emailVerified ? profile.email : null };
  return {
    next: "setPassword",
    role: intent,
    ticket: stepToken({ step: `new:${intent}`, social: account }),
    profile: { firstName: profile.firstName ?? nameOf(names.firstName), lastName: profile.lastName ?? nameOf(names.lastName), email: account.email },
  };
}

/** Parolsiz (Google/Apple) hisobni tasdiqlash — hisobni o'chirishda: yangi ID token shu foydalanuvchining identifikatori bo'lsin. */
export async function confirmOwnIdentity(userId: string, provider: SocialProvider, idToken: string): Promise<void> {
  const profile = await verifySocial(provider, idToken);
  const identity = await db.authIdentity.findUnique({ where: { provider_subject: { provider, subject: profile.subject } }, select: { userId: true } });
  if (identity?.userId !== userId) throw new ApiError("social_mismatch");
}
