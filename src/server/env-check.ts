/**
 * Muhit o'zgaruvchilarini tekshirish — sof funksiya (server-only emas: instrumentation va testlardan chaqiriladi).
 * Production'da ishlab chiqish uchun mo'ljallangan "qulayliklar" yoqilgan bo'lsa server ishga tushmaydi.
 */
type Env = Record<string, string | undefined>;

export function productionEnvProblems(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const problems: string[] = [];

  if (env.OTP_FIXED_CODE) {
    problems.push("OTP_FIXED_CODE o'rnatilgan: production'da hamma shu kod bilan istalgan hisobga kira oladi. O'chiring.");
  }
  if ((env.SMS_PROVIDER ?? "").trim().toLowerCase() === "dev") {
    problems.push("SMS_PROVIDER=dev: kodlar SMS o'rniga server log'iga chiqadi. Haqiqiy provayderni ulang.");
  }
  if (!env.SMS_PROVIDER?.trim()) {
    problems.push("SMS_PROVIDER o'rnatilmagan: hech kim tizimga kira olmaydi.");
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
