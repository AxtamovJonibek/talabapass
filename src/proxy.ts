import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Faqat til yo'nalishi. Ruxsat tekshiruvi bu yerda EMAS — har bir sahifa/action `requireRole` chaqiradi.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
