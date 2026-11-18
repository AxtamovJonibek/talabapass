import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { authSecret } from "../env";
import { authCookieOptions as cookieOptions } from "./cookie-options";

/*
 * Sayt (va Capacitor ilova) qadamlari orasidagi holat — imzolangan cookie'larda (bazada emas):
 * - `tp_pw_step` (10 daqiqa): kod bilan tasdiqlangan subyekt va keyingi qadam —
 *   `new:student|business` (yangi raqam, subyekt — raqam), `set` (parolsiz eski hisob, subyekt — foydalanuvchi id),
 *   `reset` ("Parolni unutdim", subyekt — foydalanuvchi id). `fp` — o'sha paytdagi parol xeshining izi: parol o'zgarsa
 *   eski qadam ishlamaydi;
 * - `tp_new_pw` (30 daqiqa): yangi raqamning tayyor parol xeshi — ro'yxat formasi hisobni ochganda yoziladi.
 */

const STEP_COOKIE = "tp_pw_step";
const PENDING_COOKIE = "tp_new_pw";
const STEP_TTL_MS = 10 * 60_000;
const PENDING_TTL_MS = 30 * 60_000;

export type PasswordStep = "set" | "reset" | "new:student" | "new:business";

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

/** `method` — kod qayerga kelgan (telefon yoki email): audit uchun. */
export async function rememberPasswordStep(subject: string, step: PasswordStep, fp = "-", method: "phone" | "email" = "phone"): Promise<void> {
  await writeSigned(STEP_COOKIE, "password-step", [subject, step, fp, method], STEP_TTL_MS);
}

export async function getPasswordStep(): Promise<{ subject: string; step: PasswordStep; fp: string; method: "phone" | "email" } | null> {
  const parts = await readSigned(STEP_COOKIE, "password-step");
  if (!parts || parts.length !== 4) return null;
  return { subject: parts[0]!, step: parts[1] as PasswordStep, fp: parts[2]!, method: parts[3] === "email" ? "email" : "phone" };
}

export async function forgetPasswordStep(): Promise<void> {
  (await cookies()).delete(STEP_COOKIE);
}

/** Yangi raqam: parol hisob ochilguncha xesh ko'rinishida imzolangan cookie'da turadi. */
export async function rememberPendingPassword(phone: string, hash: string): Promise<void> {
  await writeSigned(PENDING_COOKIE, "pending-password", [phone, hash], PENDING_TTL_MS);
}

/** Shu raqam uchun o'rnatilgan parol xeshi (ro'yxat formasi undan oldin parol o'rnatilganini tekshiradi). */
export async function readPendingPassword(phone: string): Promise<string | null> {
  const parts = await readSigned(PENDING_COOKIE, "pending-password");
  // Xeshda ":" bor, "." yo'q — qismlar aniq ikkita
  return parts && parts.length === 2 && parts[0] === phone && parts[1] ? parts[1] : null;
}

export async function forgetPendingPassword(): Promise<void> {
  (await cookies()).delete(PENDING_COOKIE);
}
