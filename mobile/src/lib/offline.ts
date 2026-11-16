import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CouponView, Me } from "@/api/endpoints";

/**
 * Internetsiz ishlash uchun qurilmadagi nusxa (AsyncStorage): faol kuponlar (QR va 6 raqamli kod `secret` bilan
 * qurilmada hisoblanadi) va oxirgi `me` (ilova internetsiz ochilganda kupon ekraniga o'tish uchun).
 * Kupon 10 daqiqa yashaydi; muddati o'tganlari o'qishda tashlanadi. Ro'yxatlarning oxirgi javobi (`tp.cache.*`) —
 * internetsiz ko'rsatish uchun. Chiqish/hisobni o'chirishda hammasi tozalanadi (boshqa hisob ko'rmasin).
 */

const KEYS = { coupons: "tp.coupons", me: "tp.me" } as const;

/** Kuponlar o'zgarganda (pastki menyudagi belgi, kupon ekrani) */
const listeners = new Set<(list: CouponView[]) => void>();
export function onCouponsChange(fn: (list: CouponView[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function writeCoupons(list: CouponView[]): Promise<void> {
  await write(KEYS.coupons, list);
  listeners.forEach((fn) => fn(list));
}

const alive = (c: CouponView, now = Date.now()) => Date.parse(c.expiresAt) > now;

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.warn(`[offline] ${key} o'qilmadi:`, e);
    return null;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[offline] ${key} yozilmadi:`, e);
  }
}

/** Saqlangan faol kuponlar (yangisi oldin) */
export async function cachedCoupons(): Promise<CouponView[]> {
  return ((await read<CouponView[]>(KEYS.coupons)) ?? []).filter((c) => alive(c));
}

/** Serverdagi ro'yxat bilan to'liq almashtirish (GET /coupons muvaffaqiyatli bo'lsa) */
export const replaceCoupons = (list: CouponView[]) => writeCoupons(list.filter((c) => alive(c)));

export async function rememberCoupon(coupon: CouponView): Promise<void> {
  const list = await cachedCoupons();
  await writeCoupons([coupon, ...list.filter((c) => c.id !== coupon.id)]);
}

export async function forgetCoupon(id: string): Promise<void> {
  await writeCoupons((await cachedCoupons()).filter((c) => c.id !== id));
}

export const cachedMe = () => read<Me>(KEYS.me);
export const rememberMe = (me: Me) => write(KEYS.me, me);

// ───────── ro'yxatlar keshi (useLoad `cacheKey`) ─────────

const CACHE_PREFIX = "tp.cache.";
export type Cached<T> = { data: T; savedAt: number };

/** Oxirgi muvaffaqiyatli javob — internetsiz ochilganda "oxirgi yangilanish" belgisi bilan ko'rsatiladi */
export const readCache = <T>(key: string) => read<Cached<T>>(CACHE_PREFIX + key);
export const writeCache = (key: string, data: unknown) => write(CACHE_PREFIX + key, { data, savedAt: Date.now() } satisfies Cached<unknown>);

export async function clearOffline(): Promise<void> {
  try {
    const cached = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove([KEYS.coupons, KEYS.me, ...cached]);
    listeners.forEach((fn) => fn([]));
  } catch (e) {
    console.warn("[offline] tozalanmadi:", e);
  }
}
