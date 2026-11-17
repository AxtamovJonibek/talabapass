import { Linking, Platform } from "react-native";
import type { Point } from "@/api/endpoints";

/**
 * "Qanday borasiz?" havolalari (Yonalish.dc.html): Yandex Xaritalar, Google Maps, Yandex Go. Avval ilovaning o'z havolasi
 * (o'rnatilgan bo'lsa — ilovada ochiladi), ochilmasa — oddiy https (brauzer; Google/Yandex o'zi ilovaga ham o'tkazadi).
 * Web manzillar saytdagi `src/lib/directions.ts` bilan bir xil: Yandex — `rtext=~lat,lng` (boshlang'ich nuqta — joriy joy),
 * Google — `travelmode`, Yandex Go — appmetrica orqali taksi. Marshrut turi: 1 km dan yaqin — piyoda, aks holda transport.
 */
export const PROVIDERS = ["yandex", "google", "yandexGo"] as const;
export type Provider = (typeof PROVIDERS)[number];
type RouteMode = "car" | "transit" | "walk";

const YANDEX_RTT: Record<RouteMode, string> = { car: "auto", transit: "mt", walk: "pd" };
const GOOGLE_MODE: Record<RouteMode, string> = { car: "driving", transit: "transit", walk: "walking" };
const YANDEX_GO_STORE = "1178268795219780156";
const YANDEX_GO_WEB = "25395763362139037";

const coord = (n: number) => String(Number(n.toFixed(6)));

/** Standart: 1 km dan yaqin — piyoda, aks holda jamoat transporti (saytdagi `defaultRouteMode`). */
export const defaultRouteMode = (distanceKm: number | null): RouteMode => (distanceKm !== null && distanceKm < 1 ? "walk" : "transit");

type Target = { point: Point | null; address: string; distanceKm: number | null };

/** Brauzer havolasi (zaxira). Manzil nuqtasiz bo'lsa — matn bo'yicha qidiruv; Yandex Go nuqtasiz ishlamaydi — null. */
export function directionsUrl(provider: Provider, target: Target): string | null {
  const mode = defaultRouteMode(target.distanceKm);
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
      return `https://3.redirect.appmetrica.yandex.com/route?end-lat=${lat}&end-lon=${lng}&ref=talabapass&appmetrica_tracking_id=${Platform.OS === "web" ? YANDEX_GO_WEB : YANDEX_GO_STORE}`;
  }
}

/**
 * Ilova havolasi (Yandex hujjatlaridagi sxemalar; Google Maps — iOS'da `comgooglemaps://`, Android'da https havolani
 * Google Maps ilovasi o'zi ochadi). Yo'q bo'lsa — null.
 */
export function appUrl(provider: Provider, target: Target): string | null {
  const mode = defaultRouteMode(target.distanceKm);
  const { point, address } = target;
  if (provider === "yandex") {
    return point ? `yandexmaps://maps.yandex.ru/?rtext=~${coord(point.lat)},${coord(point.lng)}&rtt=${YANDEX_RTT[mode]}` : `yandexmaps://maps.yandex.ru/?text=${encodeURIComponent(address)}`;
  }
  if (provider === "google") {
    if (Platform.OS !== "ios") return null;
    const daddr = point ? `${coord(point.lat)},${coord(point.lng)}` : encodeURIComponent(address);
    return `comgooglemaps://?daddr=${daddr}&directionsmode=${GOOGLE_MODE[mode]}`;
  }
  if (!point) return null;
  return `yandextaxi://route?end-lat=${coord(point.lat)}&end-lon=${coord(point.lng)}&ref=talabapass&appmetrica_tracking_id=${YANDEX_GO_STORE}`;
}

/** Avval ilovada, ochilmasa (ilova yo'q) — brauzerda. Ikkalasi ham ochilmasa — false. */
export async function openDirections(provider: Provider, target: Target): Promise<boolean> {
  const native = Platform.OS === "web" ? null : appUrl(provider, target);
  if (native) {
    try {
      await Linking.openURL(native);
      return true;
    } catch {
      // ilova o'rnatilmagan — brauzerga
    }
  }
  const web = directionsUrl(provider, target);
  if (!web) return false;
  try {
    await Linking.openURL(web);
    return true;
  } catch (e) {
    console.warn("[directions] havola ochilmadi:", provider, e);
    return false;
  }
}
