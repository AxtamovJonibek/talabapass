/**
 * Muhit o'zgaruvchilarini tekshirish — sof funksiya (server-only emas: instrumentation, proxy va testlardan chaqiriladi).
 * Production'da ishlab chiqish uchun mo'ljallangan "qulayliklar" yoqilgan bo'lsa server ishga tushmaydi.
 *
 * Istisno — sinov serveri (`APP_ENV=staging`): production build, SMS provayder ulanguncha OTP_FIXED_CODE va
 * SMS_PROVIDER=dev ruxsat etiladi (admin baribir parol bilan yopiq — admin-password.ts).
 * `APP_ENV` yo'q yoki boshqa qiymat — oddiy production qoidalari.
 */
type Env = Record<string, string | undefined>;

const S3_VARS = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

export function isStaging(env: Env = process.env): boolean {
  return (env.APP_ENV ?? "").trim().toLowerCase() === "staging";
}

/** OTP_FIXED_CODE va SMS dev rejimi ishlaydimi: ishlab chiqish/test yoki sinov serveri. */
export function devShortcutsAllowed(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" || isStaging(env);
}

export function productionEnvProblems(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const problems: string[] = [];

  if (isStaging(env)) {
    if ((env.STORAGE_DRIVER ?? "local").trim().toLowerCase() !== "s3") {
      problems.push("APP_ENV=staging: STORAGE_DRIVER=s3 kerak (Vercel'da lokal disk fayllarni yo'qotadi).");
    } else {
      const missing = S3_VARS.filter((name) => !env[name]?.trim());
      if (missing.length) problems.push(`STORAGE_DRIVER=s3: ${missing.join(", ")} o'rnatilmagan.`);
    }
  } else {
    if (env.OTP_FIXED_CODE) {
      problems.push("OTP_FIXED_CODE o'rnatilgan: production'da hamma shu kod bilan istalgan hisobga kira oladi. O'chiring.");
    }
    if ((env.SMS_PROVIDER ?? "").trim().toLowerCase() === "dev") {
      problems.push("SMS_PROVIDER=dev: kodlar SMS o'rniga server log'iga chiqadi. Haqiqiy provayderni ulang.");
    }
    if (!env.SMS_PROVIDER?.trim()) {
      problems.push("SMS_PROVIDER o'rnatilmagan: hech kim tizimga kira olmaydi.");
    }
  }
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    problems.push("AUTH_SECRET o'rnatilmagan yoki 32 belgidan qisqa.");
  }
  if (!env.DATABASE_URL) {
    problems.push("DATABASE_URL o'rnatilmagan.");
  }
  return problems;
}

/** Muammo bo'lsa xato tashlaydi — server start'da chaqiriladi (src/instrumentation.ts). */
export function assertProductionEnv(env: Env = process.env): void {
  const problems = productionEnvProblems(env);
  if (problems.length === 0) return;
  throw new Error(`talabaPass ishga tushmaydi — muhit sozlamalari xavfsiz emas:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
}
