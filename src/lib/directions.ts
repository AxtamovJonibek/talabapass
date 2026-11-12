import type { Point } from "./geo";

/**
 * "Yo'l ko'rsatish" oynasidagi havolalar. Hammasi oddiy https: ilova o'rnatilgan bo'lsa telefon o'zi ilovani ochadi
 * (iOS universal links, Android App Links — domenlar `apple-app-site-association` / `assetlinks.json` da ilovaga
 * bog'langan, 2026-11 da tekshirilgan), aks holda sayt ochiladi.
 * - Yandex Xaritalar: yandex.uz/maps — `rtext=~lat,lng` (boshlanish bo'sh = foydalanuvchi joyi), `rtt=auto`.
 * - Google Maps: Maps URLs, `dir/?api=1&destination=lat,lng`.
 * - 2GIS: `routeSearch/rsType/car/to/lng,lat` (uzunlik birinchi!), 2gis.uz.
 * - Yandex Go: AppMetrica redirect `route?end-lat&end-lon`; ilova bo'lsa deeplink, bo'lmasa telefonda do'kon sahifasi,
 *   kompyuterda taksi sayti (hujjatdagi ikki `appmetrica_tracking_id`).
 */
export const DIRECTIONS_PROVIDERS = ["yandex", "google", "dgis", "yandexGo"] as const;
export type DirectionsProvider = (typeof DIRECTIONS_PROVIDERS)[number];

export type Platform = "android" | "ios" | "desktop";

const YANDEX_GO_STORE = "1178268795219780156";
const YANDEX_GO_WEB = "25395763362139037";

/** iPadOS o'zini "Macintosh" deb ko'rsatadi — sensorli ekran bo'yicha ajratiladi. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  return "desktop";
}

/** 6 xona (~10 sm) yetarli; ortiqcha nollarsiz. */
const coord = (n: number) => String(Number(n.toFixed(6)));

/**
 * Manzil bo'yicha havola. Koordinata bo'lmasa — manzil matni bilan qidiruv (Yandex Go koordinatasiz ishlamaydi → null).
 */
export function directionsUrl(provider: DirectionsProvider, target: { point: Point | null; address: string }, platform: Platform): string | null {
  const { point, address } = target;
  if (!point) {
    const q = encodeURIComponent(address);
    if (provider === "yandex") return `https://yandex.uz/maps/?text=${q}`;
    if (provider === "google") return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    if (provider === "dgis") return `https://2gis.uz/search/${q}`;
    return null;
  }
  const lat = coord(point.lat);
  const lng = coord(point.lng);
  switch (provider) {
    case "yandex":
      return `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;
    case "google":
      return `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}`;
    case "dgis":
      return `https://2gis.uz/routeSearch/rsType/car/to/${lng},${lat}`;
    case "yandexGo":
      return `https://3.redirect.appmetrica.yandex.com/route?end-lat=${lat}&end-lon=${lng}&ref=talabapass&appmetrica_tracking_id=${platform === "desktop" ? YANDEX_GO_WEB : YANDEX_GO_STORE}`;
  }
}

/** Oxirgi tanlangan variant tepaga chiqadi, qolganlari o'z tartibida. */
export function orderProviders(recent: string | null): DirectionsProvider[] {
  const first = DIRECTIONS_PROVIDERS.find((p) => p === recent);
  return first ? [first, ...DIRECTIONS_PROVIDERS.filter((p) => p !== first)] : [...DIRECTIONS_PROVIDERS];
}
