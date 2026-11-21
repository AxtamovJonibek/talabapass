import "server-only";
import { createTranslator } from "next-intl";
import { z } from "zod";
import messages from "../../../messages/uz.json";
import { normalizePhone } from "@/lib/format";
import { cleanPassword, isValidPassword, maskPhone, PASSWORD_MAX } from "@/lib/password";
import { audit } from "../audit";
import { requestOtp, verifyOtp } from "../auth/otp";
import type { SocialAccount } from "../auth/new-account";
import { attemptPassword, hashPassword } from "../auth/password";
import { acceptPhoneInvite, cashierBusiness, phoneInvite } from "../business/cashiers";
import { db } from "../db";
import { authSecret } from "../env";
import { ApiError, type ApiErrorCode } from "./http";
import { passwordFingerprint, seal, unseal } from "./rules";
import { SocialTokenError, verifySocialToken, type SocialProvider } from "./social-token";
import { loadApiUser, meView, openApiSession, type Device, type MeView, type TokenPair } from "./session";

/*
 * Ilova kirishi API orqali — sayt ilova oqimi (`actions/app-auth.ts`) bilan bir xil qoidalar: telefon → SMS kod → parol.
 * Raqam ro'yxatda bor-yo'qligi faqat kod to'g'ri kiritilgandan keyin bilinadi. Qadamlar orasidagi holat cookie o'rniga
 * muhrlangan tokenlarda (mijoz faqat qaytarib yuboradi, ichini o'qiy olmaydi):
 * - `step` (10 daqiqa): tasdiqlangan raqam, keyingi qadam (`login` | `set` | `new:student|business`) va parol xeshining
 *   izi — parol o'zgarsa eski qadam tokeni ishlamaydi;
 * - `register` (30 daqiqa): yangi raqam va o'rnatilgan parol xeshi — ro'yxat endpoint'i hisobni shu bilan ochadi;
 *   Google/Apple bilan kirganda — raqam va parol o'rniga tasdiqlangan identifikator (`socialSignIn`).
 * Admin API orqali kirmaydi (ikkinchi qadam — sayt).
 */

export const STEP_TTL_MS = 10 * 60_000;
export const REGISTER_TTL_MS = 30 * 60_000;

type Step = "login" | "set" | "new:student" | "new:business" | "new:cashier";
export type Intent = "student" | "business";
/** Ro'yxat turi: kassir — telefon raqamiga taklif bo'lsa (biznes egasi ilovada qo'shgan) */
export type NewRole = Intent | "cashier";
export type SignedIn = { tokens: TokenPair; user: MeView };
/**
 * Sessiya ochuvchi: ilova — token jufti (`apiOpener`), sayt — cookie (`actions/web-auth.ts`). Qoidalar (tekshiruvlar,
 * chegaralar, parol qadamlari) ikkala yo'lda ham shu fayldagi bitta funksiyalarda.
 */
export type Opener<T> = (userId: string) => Promise<T>;
export const apiOpener =
  (device: Device): Opener<SignedIn> =>
  async (userId) => ({ tokens: await openApiSession(userId, device), user: meView(await loadApiUser(userId)) });

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

/** Ro'yxat tokeni ichidagi hisob: telefon + parol xeshi yoki Google/Apple identifikatori (parolsiz). */
export type RegisterTicket = { account: string; passwordHash: string } | { account: SocialAccount; passwordHash: string | null };

export function openRegisterTicket(token: string, role: NewRole): RegisterTicket {
  const data = unseal("register", token, authSecret());
  if (!data || data.exp <= Date.now() || data.role !== role) throw new ApiError("step_expired");
  if (typeof data.phone === "string" && typeof data.hash === "string") return { account: data.phone, passwordHash: data.hash };
  const social = data.social as Partial<SocialAccount> | undefined;
  if (
    social &&
    (social.provider === "GOOGLE" || social.provider === "APPLE") &&
    typeof social.subject === "string" &&
    (social.email === null || typeof social.email === "string")
  ) {
    return { account: { provider: social.provider, subject: social.subject, email: social.email }, passwordHash: typeof data.hash === "string" ? data.hash : null };
  }
  throw new ApiError("step_expired");
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

/** Google/Apple bilan kirgan, parolli hisobning qadam tokeni (`loginTicket`). */
function openLoginTicket(token: string): { uid: string; fp: string } | null {
  const data = unseal("step", token, authSecret());
  if (!data || data.exp <= Date.now() || data.step !== "login" || typeof data.uid !== "string" || typeof data.fp !== "string") return null;
  return { uid: data.uid, fp: data.fp };
}

export const loginWithPassword = (ticket: string, password: string, device: Device) => loginWith(ticket, password, apiOpener(device));

export async function loginWith<T>(ticket: string, password: string, open: Opener<T>): Promise<T> {
  const social = openLoginTicket(ticket);
  let user;
  if (social) {
    user = await db.user.findUnique({ where: { id: social.uid }, select: { id: true, role: true, status: true, passwordHash: true, passwordLockedUntil: true } });
    if (!user || user.role === "ADMIN" || passwordFingerprint(user.passwordHash) !== social.fp) throw new ApiError("step_expired");
    await assertUsable(user);
  } else {
    const step = openStep(ticket);
    if (step.step !== "login") throw new ApiError("step_expired");
    user = await stepUser(step);
  }

  const check = await attemptPassword(user, password);
  if (!check.ok) {
    if (check.reason === "wrong") throw new ApiError("wrong_password", { left: check.left });
    await audit({ actorId: user.id, action: "user.password.locked", entity: "User", entityId: user.id, meta: { via: "api" } });
    throw new ApiError("password_locked", { retryInSeconds: check.retryInSeconds });
  }
  return open(user.id);
}

/** Qadam tokeni telefonsiz hisob uchun (Google/Apple): foydalanuvchi identifikatori va parol xeshining izi. */
function loginTicket(userId: string, passwordHash: string): string {
  return seal("step", { uid: userId, step: "login", fp: passwordFingerprint(passwordHash) }, STEP_TTL_MS, authSecret());
}

/** Telefon (+998…) yoki email bilan, SMSsiz. Hisob yo'q / parol yo'q — baribir `wrong_password` (hisob bor-yo'qligi oshkor bo'lmaydi). */
export const signInWithPassword = (identifier: string, password: string, device: Device) => signInWith(identifier, password, apiOpener(device));

export async function signInWith<T>(identifier: string, password: string, open: Opener<T>): Promise<T> {
  const id = identifier.trim();
  const where = id.includes("@") ? { email: id.toLowerCase() } : { phone: phoneOrThrow(id) };
  const user = await db.user.findUnique({ where, select: { id: true, role: true, status: true, passwordHash: true, passwordLockedUntil: true } });
  if (!user || user.role === "ADMIN" || !user.passwordHash) throw new ApiError("wrong_password");
  if (user.status !== "ACTIVE") throw new ApiError("account_blocked");
  if (user.role === "CASHIER" && !(await cashierBusiness(user.id))) throw new ApiError("no_business");
  const check = await attemptPassword(user, password);
  if (!check.ok) {
    if (check.reason === "wrong") throw new ApiError("wrong_password", { left: check.left });
    throw new ApiError("password_locked", { retryInSeconds: check.retryInSeconds });
  }
  return open(user.id);
}

// ───────── 3b. parol o'rnatish / tiklash ─────────

export type SetPasswordResult = ({ next: "signedIn" } & SignedIn) | { next: "register"; registrationTicket: string; role: NewRole };
export type SetPasswordOutcome<T> = { next: "signedIn"; opened: T } | { next: "register"; registrationTicket: string; role: NewRole };

/**
 * Yangi raqam — ro'yxat tokeni (hisob ro'yxat endpoint'ida ochiladi); parolsiz eski hisob — parol o'rnatiladi;
 * `login` qadami ("Parolni unutdim", SMS tasdig'i hali amal qilsa) — yangi parol, boshqa barcha sessiyalar yopiladi.
 */
export async function setPassword(ticket: string, password: string, confirm: string, device: Device): Promise<SetPasswordResult> {
  const result = await setPasswordWith(ticket, password, confirm, apiOpener(device));
  return result.next === "signedIn" ? { next: "signedIn", ...result.opened } : result;
}

export async function setPasswordWith<T>(ticket: string, password: string, confirm: string, open: Opener<T>): Promise<SetPasswordOutcome<T>> {
  const pending = unseal("register", ticket, authSecret());
  if (pending && pending.exp > Date.now() && pending.social && typeof pending.role === "string") {
    // Google/Apple: parol ro'yxat ma'lumotlaridan OLDIN o'rnatiladi — xesh shu ro'yxat tokeniga yoziladi
    if (!isValidPassword(password)) throw new ApiError("weak_password");
    if (cleanPassword(password) !== cleanPassword(confirm)) throw new ApiError("password_mismatch");
    const role = pending.role as NewRole;
    return { next: "register", role, registrationTicket: seal("register", { role, social: pending.social, hash: hashPassword(password) }, REGISTER_TTL_MS, authSecret()) };
  }
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
  return { next: "signedIn", opened: await open(user.id) };
}

// ───────── Google / Apple (faqat ilova) ─────────

export type SocialResult =
  | ({ next: "signedIn" } & SignedIn)
  /** Hisob bor va parolli: SMS so'ralmaydi, o'sha hisobning paroli kiritiladi (`/auth/login`, `ticket`) */
  | { next: "password"; ticket: string; role: Intent; masked: string; initial: string | null }
  /** Yangi foydalanuvchi: SMS va parolsiz to'g'ri ro'yxatga; `profile` — formani oldindan to'ldirish uchun */
  | { next: "register"; role: Intent; registrationTicket: string; profile: { firstName: string | null; lastName: string | null; email: string | null } };

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

const SOCIAL_USER = { id: true, role: true, status: true, email: true, firstName: true, passwordHash: true } as const;

/** Telefon oqimidagi (`verifyCode`) tekshiruvlar: bloklangan/o'chirilgan, admin, biznessiz kassir. */
async function assertUsable(user: { id: string; role: string; status: string }) {
  if (user.status !== "ACTIVE") throw new ApiError("account_blocked");
  if (user.role === "ADMIN") throw new ApiError("admin_not_supported");
  if (user.role === "CASHIER" && !(await cashierBusiness(user.id))) throw new ApiError("no_business");
}

const nameOf = (v: string | undefined) => v?.trim().slice(0, 80) || null;

/**
 * Google/Apple bilan kirish. Identifikator (`provider` + `sub`) topilsa — kirish. Topilmasa, lekin provayder tasdiqlagan
 * email boshqa hisobda bo'lsa — shu hisobga bog'lanadi (bir xil email = bitta hisob). Aks holda — ro'yxat tokeni (30 daq),
 * SMS va parolsiz; ism Google tokenidan (Apple — mijoz yuborgani: Apple ismni faqat birinchi ruxsatda, ilovaga beradi).
 */
export async function socialSignIn(
  provider: SocialProvider,
  idToken: string,
  intent: Intent,
  names: { firstName?: string; lastName?: string },
  device: Device,
): Promise<SocialResult> {
  const result = await socialSignInWith(provider, idToken, intent, names, apiOpener(device));
  return result.next === "signedIn" ? { next: "signedIn", ...result.opened } : result;
}

export type SocialOutcome<T> = Exclude<SocialResult, { next: "signedIn" }> | { next: "signedIn"; opened: T };

export async function socialSignInWith<T>(
  provider: SocialProvider,
  idToken: string,
  intent: Intent,
  names: { firstName?: string; lastName?: string },
  open: Opener<T>,
): Promise<SocialOutcome<T>> {
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
    // Parolli hisob — parolni kiritadi (Google/Apple faqat shaxsni tanlaydi); parolsiz eski hisob — kiradi, parol keyin majburiy
    if (user.passwordHash) {
      return {
        next: "password",
        ticket: loginTicket(user.id, user.passwordHash),
        role: user.role === "STUDENT" ? "student" : "business",
        masked: user.email ?? profile.email ?? "",
        initial: user.firstName?.trim().charAt(0).toUpperCase() || null,
      };
    }
    return { next: "signedIn", opened: await open(user.id) };
  }

  const account: SocialAccount = { provider, subject: profile.subject, email: profile.emailVerified ? profile.email : null };
  return {
    next: "register",
    role: intent,
    registrationTicket: seal("register", { role: intent, social: account }, REGISTER_TTL_MS, authSecret()),
    profile: { firstName: profile.firstName ?? nameOf(names.firstName), lastName: profile.lastName ?? nameOf(names.lastName), email: account.email },
  };
}

/** Parolsiz (Google/Apple) hisobni tasdiqlash — hisobni o'chirishda: yangi ID token shu foydalanuvchining identifikatori bo'lsin. */
export async function confirmOwnIdentity(userId: string, provider: SocialProvider, idToken: string): Promise<void> {
  const profile = await verifySocial(provider, idToken);
  const identity = await db.authIdentity.findUnique({ where: { provider_subject: { provider, subject: profile.subject } }, select: { userId: true } });
  if (identity?.userId !== userId) throw new ApiError("social_mismatch");
}
