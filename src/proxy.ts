import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isPublicPath, seoIndexable } from "./lib/seo";

// Faqat til yo'nalishi (+ X-Robots-Tag). Ruxsat tekshiruvi bu yerda EMAS — har bir sahifa/action `requireRole`
// chaqiradi. Bu faylda faqat Edge'ga mos kod: node:* modullari, baza, `src/server` importi yo'q.
const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = intl(request);
  // SEO_INDEXABLE=false — butun sayt noindex; true — faqat ochiq sahifalar indekslanadi (panel, kirish doim noindex). docs/seo.md
  if (!seoIndexable()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  else if (!isPublicPath(request.nextUrl.pathname)) response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = {
  matcher: "/((?!api|_next|.*\\..*).*)",
};
