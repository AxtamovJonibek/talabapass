/**
 * Auth cookie'lari atributlari — sof funksiya (test bilan).
 * httpOnly: JS o'qiy olmaydi. SameSite=Lax: begona saytdan POST bilan yuborilmaydi.
 * Secure: faqat HTTPS — `next dev` (http://localhost va telefondan LAN orqali sinash) bundan mustasno.
 */
export function authCookieOptions(maxAgeMs: number, nodeEnv: string | undefined = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: nodeEnv !== "development",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}
