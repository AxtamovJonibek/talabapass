import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isStaging } from "./server/env-check";
import { STAGING_REALM, stagingAuthorized } from "./server/staging-auth";

// Til yo'nalishi + sinov serverida (APP_ENV=staging) Basic Auth. Ruxsat tekshiruvi bu yerda EMAS —
// har bir sahifa/action `requireRole` chaqiradi.
const intl = createMiddleware(routing);

/** Til yo'nalishi kerak bo'lgan yo'llar (avvalgi matcher): api, _next, _vercel va fayllar emas. */
const LOCALIZED = /^\/(?!api|_next|_vercel|.*\..*)/;

export default function proxy(request: NextRequest) {
  if (isStaging()) {
    if (!stagingAuthorized(request.headers.get("authorization"), process.env.STAGING_PASSWORD)) {
      return new NextResponse("401", {
        status: 401,
        headers: {
          "WWW-Authenticate": `Basic realm="${STAGING_REALM}", charset="UTF-8"`,
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "no-store",
        },
      });
    }
    const response = LOCALIZED.test(request.nextUrl.pathname) ? intl(request) : NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  return LOCALIZED.test(request.nextUrl.pathname) ? intl(request) : NextResponse.next();
}

// /api bu yerdan o'tmaydi: proxy so'rov tanasini buferlaydi (fayl yuklash). API manzillari sessiya/tokenni o'zi
// tekshiradi, sessiyani esa faqat Basic Auth ortidagi sahifalardan olish mumkin.
export const config = {
  matcher: "/((?!api|_next/static|_next/image|_vercel).*)",
};
