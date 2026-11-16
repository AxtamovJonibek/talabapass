import { en } from "./i18n/en";
import { ru } from "./i18n/ru";
import { uz, type Copy } from "./i18n/uz";

/**
 * Ilova tili: o'zbekcha (standart), ruscha, inglizcha. Matnlar `src/i18n/*` da (kalitlar bir xil — `Copy` tipi).
 * `copy` — joriy tilning matnlari: kodda `copy.feed.title` kabi o'qiladi, til almashsa keyingi chizishda yangisi
 * (`LangProvider` ilova ekranlarini qayta chizadi). Tanlov qurilmada saqlanadi (`storage.ts`), serverga
 * `Accept-Language` bilan ketadi (`api/client.ts`).
 */

export type Lang = "uz" | "ru" | "en";
export type { Copy };

/** Til tanlovi ro'yxati — nomlar o'z tilida (Til ekrani va Profil) */
export const LANGS: readonly { id: Lang; name: string; code: string }[] = [
  { id: "uz", name: "O'zbekcha", code: "UZ" },
  { id: "ru", name: "Русский", code: "RU" },
  { id: "en", name: "English", code: "EN" },
];

const DICTS: Record<Lang, Copy> = { uz, ru, en };
let current: Lang = "uz";

export const isLang = (v: unknown): v is Lang => v === "uz" || v === "ru" || v === "en";

/** Joriy til matnlari. Modul darajasida (`const x = copy.feed`) olib qo'ymang — til almashsa eskisi qoladi. */
export const copy: Copy = new Proxy({} as Copy, { get: (_target, key) => Reflect.get(DICTS[current], key) });

/** Boshqa tildagi matnlar (Til ekrani tanlanayotgan tilni oldindan ko'rsatadi) */
export const copyFor = (lang: Lang): Copy => DICTS[lang];

export const currentLang = (): Lang => current;

/** Joriy til nomi o'z tilida ("Русский") — Profildagi qator */
export const langName = () => LANGS.find((l) => l.id === current)?.name ?? "";

/** Faqat `LangProvider` chaqiradi (saqlash va qayta chizish u yerda). */
export function applyLang(lang: Lang) {
  current = lang;
}

/** Qurilma tili (birinchi ochilishda Til ekranidagi oldindan tanlov); aniqlanmasa — o'zbekcha. */
export function deviceLang(): Lang {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (tag.startsWith("ru")) return "ru";
    if (tag.startsWith("en")) return "en";
  } catch {
    // Intl yo'q — standart
  }
  return "uz";
}
