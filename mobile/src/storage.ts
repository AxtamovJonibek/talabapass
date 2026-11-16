import * as Secure from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Qurilmadagi saqlash — hammasi expo-secure-store'da (Keychain / Android Keystore): tokenlar va kichik sozlamalar.
 * Kalitlar faqat harf, raqam, ".", "-", "_". Web (faqat dizaynni ko'rib chiqish, `npm run web`) — localStorage.
 */
const SecureStore =
  Platform.OS === "web"
    ? {
        getItemAsync: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
        setItemAsync: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
        deleteItemAsync: async (key: string) => globalThis.localStorage?.removeItem(key),
      }
    : Secure;
const KEYS = {
  access: "tp.access",
  accessExp: "tp.accessExp",
  refresh: "tp.refresh",
  onboardedStudent: "tp.onboarded.student",
  onboardedBusiness: "tp.onboarded.business",
  lastPhone: "tp.lastPhone",
  lang: "tp.lang",
} as const;

export type StoredTokens = { accessToken: string; accessTokenExpiresAt: string; refreshToken: string };

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, accessTokenExpiresAt, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access),
    SecureStore.getItemAsync(KEYS.accessExp),
    SecureStore.getItemAsync(KEYS.refresh),
  ]);
  return refreshToken ? { accessToken: accessToken ?? "", accessTokenExpiresAt: accessTokenExpiresAt ?? "", refreshToken } : null;
}

export async function saveTokens(t: StoredTokens): Promise<void> {
  // Refresh oxirida yoziladi: yarim yo'lda to'xtasa ham eski (hali yaroqli) juft qolmaydi
  await SecureStore.setItemAsync(KEYS.access, t.accessToken);
  await SecureStore.setItemAsync(KEYS.accessExp, t.accessTokenExpiresAt);
  await SecureStore.setItemAsync(KEYS.refresh, t.refreshToken);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(KEYS.access), SecureStore.deleteItemAsync(KEYS.accessExp), SecureStore.deleteItemAsync(KEYS.refresh)]);
}

/** Tanishtiruv karuseli ko'rilganmi (har rol uchun bir marta). */
export async function wasOnboarded(kind: "student" | "business"): Promise<boolean> {
  return (await SecureStore.getItemAsync(kind === "student" ? KEYS.onboardedStudent : KEYS.onboardedBusiness)) === "1";
}

export async function markOnboarded(kind: "student" | "business"): Promise<void> {
  await SecureStore.setItemAsync(kind === "student" ? KEYS.onboardedStudent : KEYS.onboardedBusiness, "1");
}

/** Oxirgi kirgan raqam (9 raqam, +998 siz) — chiqqandan keyin "Qayta xush kelibsiz" (Auth2). */
export const getLastPhone = () => SecureStore.getItemAsync(KEYS.lastPhone);
export const setLastPhone = (digits: string) => SecureStore.setItemAsync(KEYS.lastPhone, digits);
export const forgetLastPhone = () => SecureStore.deleteItemAsync(KEYS.lastPhone);

/** Tanlangan til ("uz" | "ru" | "en"); null — hali tanlanmagan (birinchi ochilish: Til ekrani). */
export const getStoredLang = () => SecureStore.getItemAsync(KEYS.lang);
export const setStoredLang = (lang: string) => SecureStore.setItemAsync(KEYS.lang, lang);
