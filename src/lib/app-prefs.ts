import { Preferences } from "@capacitor/preferences";

/**
 * Ilova sozlamalari qurilmada (Capacitor Preferences). Plagin yo'q eski APK yoki brauzer — localStorage.
 * Faqat qulaylik uchun (birinchi ochilish, oxirgi raqam): o'qib bo'lmasa — yo'q deb hisoblanadi.
 */
export const PREF = {
  /** Tanishtiruv karuseli ko'rilgan */
  onboarded: "tp.onboarded",
  /** Oxirgi muvaffaqiyatli kirilgan raqam (E.164) — "Qayta xush kelibsiz" ekrani */
  lastPhone: "tp.lastPhone",
} as const;

type Key = (typeof PREF)[keyof typeof PREF];

export async function readPref(key: Key): Promise<string | null> {
  try {
    return (await Preferences.get({ key })).value;
  } catch {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

export async function writePref(key: Key, value: string | null): Promise<void> {
  try {
    if (value === null) await Preferences.remove({ key });
    else await Preferences.set({ key, value });
  } catch {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      // saqlab bo'lmadi — keyingi safar yana ko'rsatiladi
    }
  }
}
