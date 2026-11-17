import { createHash, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/seo";
import { seal, unseal } from "./rules";

/*
 * Apple bilan kirish — web oqimi (Android ilovasi; iOS native `expo-apple-authentication` ishlatadi). Bazasiz:
 *
 * 1. Ilova tasodifiy `verifier` yaratadi, `state = base64url(sha256(verifier))`, brauzerda
 *    `GET /api/v1/auth/apple/start?state=…` ni ochadi → Apple'ning kirish sahifasi (Services ID bilan).
 * 2. Apple `form_post` bilan `POST /api/v1/auth/apple/callback` ga `id_token`, `state`, (birinchi marta) `user` yuboradi.
 *    Server ularni muhrlangan `ticket` ga joylaydi (10 daqiqa) va `talabapass://auth/apple?ticket=…` ga qaytaradi.
 * 3. Ilova `POST /api/v1/auth/apple { ticket, verifier }` yuboradi; server `sha256(verifier) = state` ni tekshiradi.
 *
 * Deep link'ni boshqa ilova ushlab olsa ham, `verifier` siz ticket ochilmaydi (PKCE g'oyasi). Token tekshiruvi
 * (`aud` — `APPLE_CLIENT_ID` dagi Services ID) odatdagi `verifySocialToken` da.
 */

export const APPLE_CALLBACK_URL = `${SITE_URL}/api/v1/auth/apple/callback`;
export const APPLE_TICKET_TTL_MS = 10 * 60_000;
const APP_PACKAGE = "uz.talabapass.app";
const APP_SCHEME = "talabapass";

/** sha256 ning base64url ko'rinishi — 43 belgi */
export const STATE_RE = /^[A-Za-z0-9_-]{43}$/;

export const stateOf = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function appleAuthorizeUrl(clientId: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: APPLE_CALLBACK_URL,
    response_type: "code id_token",
    // Ism va email so'ralsa Apple faqat form_post bilan qaytaradi
    response_mode: "form_post",
    scope: "name email",
    state,
  });
  return `https://appleid.apple.com/auth/authorize?${q.toString().replace(/\+/g, "%20")}`;
}

/**
 * Ilovaga qaytish manzili. Android Chrome (Custom Tab) serverdagi qayta yo'naltirishdan keyin `talabapass://` ni har doim
 * ochavermaydi — `intent://` (paket nomi bilan) ishonchli; iOS va boshqalar — oddiy sxema.
 */
export function appReturnUrl(params: Record<string, string>, userAgent: string | null): string {
  const q = new URLSearchParams(params).toString();
  if (/android/i.test(userAgent ?? "")) return `intent://auth/apple?${q}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};end`;
  return `${APP_SCHEME}://auth/apple?${q}`;
}

const NAME_MAX = 80;
const name = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, NAME_MAX) : undefined);

/** Apple `user` maydoni (faqat birinchi ruxsatda): `{"name":{"firstName":"…","lastName":"…"},"email":"…"}` */
export function parseAppleUser(raw: string | null): { firstName?: string; lastName?: string } {
  if (!raw || raw.length > 2000) return {};
  try {
    const user = JSON.parse(raw) as { name?: { firstName?: unknown; lastName?: unknown } };
    return { firstName: name(user.name?.firstName), lastName: name(user.name?.lastName) };
  } catch {
    return {};
  }
}

export type AppleTicket = { idToken: string; firstName?: string; lastName?: string };

export function sealAppleTicket(state: string, data: AppleTicket, secret: string, now = Date.now()): string {
  return seal("apple", { state, ...data }, APPLE_TICKET_TTL_MS, secret, now);
}

/** Ticket va verifier mos, muddati o'tmagan — token va ism; aks holda null. */
export function openAppleTicket(ticket: string, verifier: string, secret: string, now = Date.now()): AppleTicket | null {
  const data = unseal("apple", ticket, secret);
  if (!data || data.exp < now || typeof data.idToken !== "string" || typeof data.state !== "string") return null;
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) return null;
  const expected = Buffer.from(data.state);
  const actual = Buffer.from(stateOf(verifier));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { idToken: data.idToken, firstName: name(data.firstName), lastName: name(data.lastName) };
}
