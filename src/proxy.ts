import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

// Faqat til yo'nalishi (+ sinov serverida noindex sarlavhasi). Ruxsat tekshiruvi bu yerda EMAS —
// har bir sahifa/action `requireRole` chaqiradi. Bu faylda faqat Edge'ga mos kod: node:* modullari, baza,
// `src/server` importi yo'q (Vercel'da alohida funksiya bo'lib ishlaydi).
const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = intl(request);
  if ((process.env.APP_ENV ?? "").trim().toLowerCase() === "staging") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
