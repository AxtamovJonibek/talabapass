import type { Point } from "./geo";

/**
 * "Qanday boraman?" oynasidagi havolalar. Hammasi oddiy https: ilova o'rnatilgan bo'lsa telefon o'zi ilovani ochadi
 * (iOS universal links, Android App Links — domenlar `apple-app-site-association` / `assetlinks.json` da ilovaga
 * bog'langan, 2026-11 da tekshirilgan), aks holda sayt ochiladi. Foydalanuvchiga bu haqda yozilmaydi.
 * - Yandex Xaritalar: yandex.uz/maps — `rtext=~lat,lng` (boshlang'ich nuqta bo'sh — foydalanuvchi joyi), `rtt` = auto | mt | pd
 *   (hujjat: yandex-apps-launch-maps, "Яндекс Карты (веб)"; bo'sh boshlang'ich nuqta hujjatda yozilmagan, amalda joriy joy).
 * - Google Maps: Maps URLs, `dir/?api=1&destination=lat%2Clng&travelmode=driving|transit|walking`; `origin` berilmasa —
 *   qurilma joylashuvi (hujjatda: "Defaults to most relevant starting location, such as device location").
 * - Yandex Go (taksi): AppMetrica redirect `route?end-lat&end-lon`; ilova bo'lsa deeplink, bo'lmasa telefonda do'kon sahifasi,
 *   kompyuterda taksi sayti (hujjatdagi ikki `appmetrica_tracking_id`). Marshrut turiga bog'liq emas.
 */
export const DIRECTIONS_PROVIDERS = ["yandex", "google", "yandexGo"] as const;
export type DirectionsProvider = (typeof DIRECTIONS_PROVIDERS)[number];

/** Marshrut turi: mashinada, jamoat transporti, piyoda */
export const ROUTE_MODES = ["car", "transit", "walk"] as const;
export type RouteMode = (typeof ROUTE_MODES)[number];

const YANDEX_RTT: Record<RouteMode, string> = { car: "auto", transit: "mt", walk: "pd" };
const GOOGLE_MODE: Record<RouteMode, string> = { car: "driving", transit: "transit", walk: "walking" };

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
 * Manzil bo'yicha havola. Koordinata bo'lmasa — manzil matni bilan (Yandex — qidiruv, Google — manzilgacha marshrut;
 * Yandex Go koordinatasiz ishlamaydi → null).
 */
export function directionsUrl(provider: DirectionsProvider, target: { point: Point | null; address: string }, platform: Platform, mode: RouteMode = "car"): string | null {
  const { point, address } = target;
  if (!point) {
    const q = encodeURIComponent(address);
    if (provider === "yandex") return `https://yandex.uz/maps/?text=${q}`;
    if (provider === "google") return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=${GOOGLE_MODE[mode]}`;
    return null;
  }
  const lat = coord(point.lat);
  const lng = coord(point.lng);
  switch (provider) {
    case "yandex":
      return `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=${YANDEX_RTT[mode]}`;
    case "google":
      return `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}&travelmode=${GOOGLE_MODE[mode]}`;
    case "yandexGo":
      return `https://3.redirect.appmetrica.yandex.com/route?end-lat=${lat}&end-lon=${lng}&ref=talabapass&appmetrica_tracking_id=${platform === "desktop" ? YANDEX_GO_WEB : YANDEX_GO_STORE}`;
  }
}

/** Oxirgi tanlangan variant tepaga chiqadi, qolganlari o'z tartibida (Yandex, Google, taksi). */
export function orderProviders(recent: string | null): DirectionsProvider[] {
  const first = DIRECTIONS_PROVIDERS.find((p) => p === recent);
  return first ? [first, ...DIRECTIONS_PROVIDERS.filter((p) => p !== first)] : [...DIRECTIONS_PROVIDERS];
}

/** Standart marshrut turi: saqlangan tanlov, bo'lmasa 1 km dan yaqin — piyoda, aks holda jamoat transporti. */
export function defaultRouteMode(saved: string | null, distanceKm: number | null): RouteMode {
  const known = ROUTE_MODES.find((m) => m === saved);
  if (known) return known;
  return distanceKm !== null && distanceKm < 1 ? "walk" : "transit";
}

/** "600 m", "1.2 km", "12 km" — 1 km gacha 100 m ga yaxlitlanadi, "~" yozilmaydi. */
export function formatDistance(km: number): string {
  if (km < 1) {
    const m = Math.max(100, Math.round((km * 1000) / 100) * 100);
    return m >= 1000 ? "1 km" : `${m} m`;
  }
  if (km >= 10) return `${Math.round(km)} km`;
  return `${Number((Math.round(km * 10) / 10).toFixed(1))} km`;
}
