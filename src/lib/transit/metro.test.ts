import { describe, expect, it } from "vitest";
import { distanceKm } from "../geo";
import { formatMetroDistance, METRO_STATIONS, nearestMetro } from "./metro";

/** Nuqtadan shimolga `m` metr */
const north = (p: { lat: number; lng: number }, m: number) => ({ lat: p.lat + m / 111_195, lng: p.lng });
const station = (name: string) => METRO_STATIONS.find((s) => s.name === name)!;

describe("eng yaqin metro", () => {
  it("bekatning o'zi va 600 m shimoli — o'sha bekat", () => {
    expect(nearestMetro(station("Chilonzor"))).toEqual({ name: "Chilonzor", km: 0 });
    const near = nearestMetro(north(station("Chilonzor"), 600))!;
    expect(near.name).toBe("Chilonzor");
    expect(formatMetroDistance(near.km)).toBe("600 m");
  });

  it("ma'lum joylar: Chorsu bozori — Chorsu, Mustaqillik maydoni — o'sha nomli bekat", () => {
    const bazaar = nearestMetro({ lat: 41.3268, lng: 69.2347 })!;
    expect(bazaar.name).toBe("Chorsu");
    expect(formatMetroDistance(bazaar.km)).toBe("300 m");
    expect(nearestMetro({ lat: 41.3157, lng: 69.2695 })!.name).toBe("Mustaqillik maydoni");
  });

  it("1.5 km dan uzoq — ko'rsatilmaydi; 1 km dan oshsa km bilan", () => {
    expect(nearestMetro({ lat: 41.11, lng: 69.05 })).toBeNull();
    const far = north(station("Turkiston"), 1200);
    const result = nearestMetro(far)!;
    expect(result.name).toBe("Turkiston");
    expect(formatMetroDistance(result.km)).toBe("1.2 km");
    expect(formatMetroDistance(0.04)).toBe("100 m");
    expect(formatMetroDistance(0.97)).toBe("1 km");
  });

  it("ro'yxat: 50 bekat, nomlar takrorlanmaydi, hammasi Toshkent atrofida", () => {
    expect(METRO_STATIONS).toHaveLength(50);
    expect(new Set(METRO_STATIONS.map((s) => s.name)).size).toBe(50);
    const center = { lat: 41.3111, lng: 69.2797 };
    expect(METRO_STATIONS.every((s) => distanceKm(center, s) < 20)).toBe(true);
  });
});
