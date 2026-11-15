import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Origin, Place } from "@/api/endpoints";
import { copy } from "@/copy";

/**
 * Masofa qayerdan hisoblanadi (saytdagi `tp_loc` cookie / `tp:joy` o'rniga): GPS, Toshkent tumani yoki viloyat.
 * Tanlov qurilmada saqlanadi (`tp.joy`). GPS ~100 m ga yaxlitlanadi (server ham yaxlitlaydi). Tanlanmagan — "Toshkent",
 * masofasiz (saytdagidek).
 */

export type Choice = { kind: "gps"; lat: number; lng: number } | { kind: "district"; place: Place } | { kind: "region"; place: Place };

export type LocateResult = { ok: true; lat: number; lng: number } | { ok: false; reason: "denied" | "unavailable"; canAskAgain: boolean };

type Ctx = {
  choice: Choice | null;
  origin: Origin;
  label: string;
  /** Joy tanlovi tiklanguncha false (birinchi so'rov keraksiz masofasiz ketmasin) */
  ready: boolean;
  choose: (choice: Choice | null) => void;
  /** Ruxsat so'rab GPS'dan aniqlash; muvaffaqiyatli bo'lsa tanlov GPS ga o'tadi */
  locate: () => Promise<LocateResult>;
};

const KEY = "tp.joy";
const round = (n: number) => Math.round(n * 1000) / 1000;

const LocationContext = createContext<Ctx | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setChoice(JSON.parse(raw) as Choice);
      })
      .catch((e: unknown) => console.warn("[joy] o'qilmadi:", e))
      .finally(() => setReady(true));
  }, []);

  const choose = useCallback((next: Choice | null) => {
    setChoice(next);
    void (next ? AsyncStorage.setItem(KEY, JSON.stringify(next)) : AsyncStorage.removeItem(KEY)).catch((e: unknown) => console.warn("[joy] saqlanmadi:", e));
  }, []);

  const locate = useCallback(async (): Promise<LocateResult> => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return { ok: false, reason: "denied", canAskAgain: perm.canAskAgain };
      const pos =
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
        ])) ?? (await Location.getLastKnownPositionAsync());
      if (!pos) return { ok: false, reason: "unavailable", canAskAgain: true };
      const point = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
      choose({ kind: "gps", ...point });
      return { ok: true, ...point };
    } catch (e) {
      console.warn("[joy] GPS xatosi:", e);
      return { ok: false, reason: "unavailable", canAskAgain: true };
    }
  }, [choose]);

  const value = useMemo<Ctx>(() => {
    const origin: Origin = !choice
      ? null
      : choice.kind === "gps"
        ? { lat: choice.lat, lng: choice.lng }
        : choice.kind === "district"
          ? { districtId: choice.place.id }
          : { regionId: choice.place.id };
    const label = !choice ? copy.feed.location.city : choice.kind === "gps" ? copy.feed.location.here : choice.place.name;
    return { choice, origin, label, ready, choose, locate };
  }, [choice, ready, choose, locate]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): Ctx {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("LocationProvider yo'q");
  return ctx;
}

/** Toshkent markazi (Amir Temur xiyoboni) — joylashuv o'chiq bo'lganda xarita va yaqin joylar shundan */
export const TASHKENT = { lat: 41.3111, lng: 69.2797 } as const;
