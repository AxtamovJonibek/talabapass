import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Rus va ingliz tillari: messages/ru.json (en.json) qo'shing va shu ro'yxatga kiriting.
  locales: ["uz"],
  defaultLocale: "uz",
  // Asosiy til prefikssiz (/), qolganlari /ru, /en ko'rinishida.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
