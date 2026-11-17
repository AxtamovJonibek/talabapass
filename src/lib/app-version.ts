/**
 * Mobil ilova versiyalari (`GET /api/v1/app-config`): majburiy yangilash chegarasi va do'kon havolalari env'dan.
 * Sof funksiyalar (server va testlar). Ilova `mobile/src/lib/app-version.ts` da xuddi shu taqqoslashni qiladi.
 */

export const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

/** "1.2.10" vs "1.10.0" → -1 | 0 | 1 (raqamlar bo'yicha; noto'g'ri ko'rinish — 0.0.0) */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => (VERSION_RE.test(v.trim()) ? v.trim().split(".").map(Number) : [0, 0, 0]);
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    if (x[i]! !== y[i]!) return x[i]! < y[i]! ? -1 : 1;
  }
  return 0;
}

export const DEFAULT_STORE_URLS = {
  android: "https://play.google.com/store/apps/details?id=uz.talabapass.app",
  ios: null as string | null,
};

export type AppConfig = {
  minVersion: { ios: string; android: string };
  latestVersion: string;
  storeUrls: { ios: string | null; android: string | null };
  /**
   * Kirish usullari (ilova tugmalari): telefon — `AUTH_PHONE_ENABLED` (standart true), Google/Apple — client ID sozlanganmi;
   * `appleWeb` — Android'dagi Apple web oqimi uchun `APPLE_CLIENT_ID` da Services ID bormi.
   */
  auth: { phone: boolean; google: boolean; apple: boolean; appleWeb: boolean };
};

type Env = Record<string, string | undefined>;
const version = (value: string | undefined, fallback: string) => (value && VERSION_RE.test(value.trim()) ? value.trim() : fallback);
const url = (value: string | undefined, fallback: string | null) => (value?.trim().startsWith("https://") ? value.trim() : fallback);
const set = (...values: (string | undefined)[]) => values.some((v) => Boolean(v?.trim()));

/** iOS ilovasining bundle ID'si — Apple native kirish tokenining `aud` i */
export const APPLE_BUNDLE_ID = "uz.talabapass.app";

/**
 * Apple web oqimi (Android) uchun Services ID: `APPLE_CLIENT_ID` (vergul bilan, masalan `uz.talabapass.app,uz.talabapass.signin`)
 * dagi bundle ID bo'lmagan birinchi qiymat. Yo'q — null (Android'da Apple bilan kirish sozlanmagan).
 */
export function appleWebClientId(env: Env): string | null {
  const ids = (env.APPLE_CLIENT_ID ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return ids.find((id) => id !== APPLE_BUNDLE_ID) ?? null;
}

/**
 * Env: `APP_MIN_VERSION_IOS`, `APP_MIN_VERSION_ANDROID` (shundan past — majburiy yangilash), `APP_LATEST_VERSION`,
 * `APP_STORE_URL_IOS`, `APP_STORE_URL_ANDROID`. Berilmagan/noto'g'ri — 1.0.0 (hech kim to'silmaydi), Play havolasi standart.
 */
export function appConfigFromEnv(env: Env): AppConfig {
  return {
    minVersion: { ios: version(env.APP_MIN_VERSION_IOS, "1.0.0"), android: version(env.APP_MIN_VERSION_ANDROID, "1.0.0") },
    latestVersion: version(env.APP_LATEST_VERSION, "1.0.0"),
    storeUrls: { ios: url(env.APP_STORE_URL_IOS, DEFAULT_STORE_URLS.ios), android: url(env.APP_STORE_URL_ANDROID, DEFAULT_STORE_URLS.android) },
    auth: {
      phone: env.AUTH_PHONE_ENABLED?.trim().toLowerCase() !== "false",
      google: set(env.GOOGLE_CLIENT_ID_WEB, env.GOOGLE_CLIENT_ID_IOS, env.GOOGLE_CLIENT_ID_ANDROID),
      apple: set(env.APPLE_CLIENT_ID),
      appleWeb: appleWebClientId(env) !== null,
    },
  };
}

/** env-check uchun: berilgan, lekin noto'g'ri qiymatlar (jimgina standartga tushib qolmasin). */
export function appConfigProblems(env: Env): string[] {
  const problems: string[] = [];
  for (const name of ["APP_MIN_VERSION_IOS", "APP_MIN_VERSION_ANDROID", "APP_LATEST_VERSION"]) {
    const v = env[name]?.trim();
    if (v && !VERSION_RE.test(v)) problems.push(`${name}=${v}: versiya X.Y.Z ko'rinishida bo'lsin (masalan 1.2.0).`);
  }
  for (const name of ["APP_STORE_URL_IOS", "APP_STORE_URL_ANDROID"]) {
    const v = env[name]?.trim();
    if (v && !v.startsWith("https://")) problems.push(`${name}: https:// bilan boshlanadigan havola bo'lsin.`);
  }
  const phone = env.AUTH_PHONE_ENABLED?.trim().toLowerCase();
  if (phone && phone !== "true" && phone !== "false") problems.push(`AUTH_PHONE_ENABLED=${phone}: true yoki false bo'lsin.`);
  for (const name of ["GOOGLE_CLIENT_ID_WEB", "GOOGLE_CLIENT_ID_IOS", "GOOGLE_CLIENT_ID_ANDROID"]) {
    const v = env[name]?.trim();
    if (v && !v.endsWith(".apps.googleusercontent.com")) problems.push(`${name}: Google client ID (…apps.googleusercontent.com) bo'lsin.`);
  }
  return problems;
}
