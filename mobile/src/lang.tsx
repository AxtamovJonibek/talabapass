import { applyLang, isLang, type Lang } from "@/copy";
import { getStoredLang, setStoredLang } from "@/storage";

/**
 * Tanlangan til: ishga tushishda o'qiladi (`loadLang`, splash ostida), almashtirilganda saqlanadi (`changeLang`).
 * Til almashgach chaqiruvchi ilovani bosh ekrandan qayta ochadi (`resetTo`) — barcha ekranlar yangi tilda yaratiladi.
 */

/** Saqlangan tilni qo'llaydi. `null` — hali tanlanmagan (birinchi ochilish: Til ekrani). */
export async function loadLang(): Promise<Lang | null> {
  try {
    const stored = await getStoredLang();
    if (isLang(stored)) {
      applyLang(stored);
      return stored;
    }
  } catch {
    // Saqlash o'qilmadi — standart til
  }
  return null;
}

export async function changeLang(lang: Lang): Promise<void> {
  await setStoredLang(lang).catch(() => undefined);
  applyLang(lang);
}
