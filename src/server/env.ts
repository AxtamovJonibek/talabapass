import "server-only";

/** Imzolar va xeshlar uchun server siri. Kamida 32 belgi. */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET o'rnatilmagan yoki juda qisqa (kamida 32 belgi). .env.example ga qarang.");
  }
  return secret;
}

export const isProduction = process.env.NODE_ENV === "production";

/**
 * Faqat ishlab chiqish/test uchun: belgilansa har bir SMS kod shu qiymat bo'ladi.
 * Production'da e'tiborga olinmaydi.
 */
export function fixedOtpForDev(): string | null {
  const code = process.env.OTP_FIXED_CODE;
  return !isProduction && code && /^\d{6}$/.test(code) ? code : null;
}
