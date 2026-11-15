import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Rus va ingliz tillari: messages/ru.json (en.json) qo'shing va shu ro'yxatga kiriting.
  locales: ["uz"],
  defaultLocale: "uz",
  // Har bir manzil til prefiksi bilan (/uz/...); "/" → "/uz" oddiy redirect. "as-needed" dagi ichki rewrite
  // nginx orqasida (VPS) "/" → "/" cheksiz 307 berardi.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/**
 * Ilova yo'liga til prefiksini qo'shadi: "/" → "/uz", "/#savollar" → "/uz#savollar", "/kirish" → "/uz/kirish".
 * next-intl `Link`/`redirect` o'zi qo'yadi — bu faqat ulardan tashqaridagi manzillar uchun (push, QR, service worker, to'lov).
 */
export function localizedPath(path: string, locale: Locale = routing.defaultLocale): string {
  return `/${locale}${path === "/" || /^\/[?#]/.test(path) ? path.slice(1) : path}`;
}
