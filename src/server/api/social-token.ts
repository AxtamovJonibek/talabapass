import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

/*
 * Google / Apple ID token (ilova kirishi) tekshiruvi — bazasiz, testlar bilan (`social-token.test.ts`).
 * Imzo provayderning ochiq kalitlari (JWKS, kesh bilan) bilan, `iss`, `aud` (bizning client ID'lar) va muddat
 * tekshiriladi. Foydalanuvchi id — `sub` (doimiy); email faqat `email_verified` bo'lsa hisob bog'lash uchun ishlatiladi.
 */

export type SocialProvider = "GOOGLE" | "APPLE";

export type SocialProfile = {
  provider: SocialProvider;
  subject: string;
  /** Kichik harfda; `emailVerified` bo'lmasa — hisob bog'lanmaydi va saqlanmaydi */
  email: string | null;
  emailVerified: boolean;
  /** Faqat ro'yxat formasini oldindan to'ldirish uchun (Apple ismni tokenda bermaydi — mijoz yuboradi) */
  firstName: string | null;
  lastName: string | null;
};

type Env = Record<string, string | undefined>;

const list = (...values: (string | undefined)[]) =>
  values
    .flatMap((v) => (v ?? "").split(","))
    .map((v) => v.trim())
    .filter(Boolean);

/** Token `aud` qiymatlari: Google — web (Android tokeni ham shu), iOS va Android client ID; Apple — bundle ID (vergul bilan bir nechta). */
export function audiences(provider: SocialProvider, env: Env = process.env): string[] {
  return provider === "GOOGLE"
    ? list(env.GOOGLE_CLIENT_ID_WEB, env.GOOGLE_CLIENT_ID_IOS, env.GOOGLE_CLIENT_ID_ANDROID)
    : list(env.APPLE_CLIENT_ID);
}

const ISSUERS: Record<SocialProvider, string[]> = {
  GOOGLE: ["https://accounts.google.com", "accounts.google.com"],
  APPLE: ["https://appleid.apple.com"],
};

const JWKS_URL: Record<SocialProvider, string> = {
  GOOGLE: "https://www.googleapis.com/oauth2/v3/certs",
  APPLE: "https://appleid.apple.com/auth/keys",
};

const remote: Partial<Record<SocialProvider, JWTVerifyGetKey>> = {};
const keysOf = (provider: SocialProvider) => (remote[provider] ??= createRemoteJWKSet(new URL(JWKS_URL[provider])));

export class SocialTokenError extends Error {
  constructor(readonly reason: "unconfigured" | "invalid" | "unreachable") {
    super(reason);
  }
}

const NAME_MAX = 80;
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, NAME_MAX) : null);

/** Tekshirilgan da'volardan profil. Google `email_verified` — boolean, Apple — ba'zan "true" satri. */
export function profileFromClaims(provider: SocialProvider, claims: JWTPayload): SocialProfile {
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) throw new SocialTokenError("invalid");
  const rawEmail = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  const email = rawEmail && rawEmail.length <= 254 && rawEmail.includes("@") ? rawEmail : null;
  const verified = claims.email_verified === true || claims.email_verified === "true";
  return {
    provider,
    subject: claims.sub,
    email,
    emailVerified: Boolean(email) && verified,
    firstName: text(claims.given_name),
    lastName: text(claims.family_name),
  };
}

/**
 * ID tokenni tekshiradi. Client ID sozlanmagan — `unconfigured` (API: 503), imzo/aud/iss/muddat xato — `invalid`,
 * kalitlarni olib bo'lmadi — `unreachable`. `keys` — testlar uchun (aks holda provayder JWKS'i).
 */
export async function verifySocialToken(
  provider: SocialProvider,
  idToken: string,
  { env = process.env, keys, now }: { env?: Env; keys?: JWTVerifyGetKey; now?: Date } = {},
): Promise<SocialProfile> {
  const audience = audiences(provider, env);
  if (audience.length === 0) throw new SocialTokenError("unconfigured");
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, keys ?? keysOf(provider), {
      issuer: ISSUERS[provider],
      audience,
      algorithms: ["RS256", "ES256"],
      clockTolerance: 60,
      currentDate: now,
    }));
  } catch (error) {
    if (error instanceof errors.JWKSTimeout || (error instanceof Error && /fetch|network|ECONN|ENOTFOUND/i.test(error.message) && !(error instanceof errors.JOSEError))) {
      throw new SocialTokenError("unreachable");
    }
    throw new SocialTokenError("invalid");
  }
  return profileFromClaims(provider, payload);
}
