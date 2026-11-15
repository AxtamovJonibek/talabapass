import { Platform } from "react-native";
import type { Point } from "@/api/endpoints";

/**
 * "Qanday boraman?" havolalari — saytdagi `src/lib/directions.ts` bilan bir xil (oddiy https: ilova o'rnatilgan bo'lsa
 * telefon o'zi ochadi). Yandex — `rtext=~lat,lng` (boshlang'ich nuqta — joriy joy), Google — `travelmode`, Yandex Go — taksi.
 */
export const PROVIDERS = ["yandex", "google", "yandexGo"] as const;
export type Provider = (typeof PROVIDERS)[number];
export const ROUTE_MODES = ["car", "transit", "walk"] as const;
export type RouteMode = (typeof ROUTE_MODES)[number];

const YANDEX_RTT: Record<RouteMode, string> = { car: "auto", transit: "mt", walk: "pd" };
const GOOGLE_MODE: Record<RouteMode, string> = { car: "driving", transit: "transit", walk: "walking" };
const YANDEX_GO_STORE = "1178268795219780156";
const YANDEX_GO_WEB = "25395763362139037";

const coord = (n: number) => String(Number(n.toFixed(6)));

export function directionsUrl(provider: Provider, target: { point: Point | null; address: string }, mode: RouteMode): string | null {
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

/** Standart: 1 km dan yaqin — piyoda, aks holda jamoat transporti (saytdagi `defaultRouteMode`). */
export const defaultRouteMode = (distanceKm: number | null): RouteMode => (distanceKm !== null && distanceKm < 1 ? "walk" : "transit");
