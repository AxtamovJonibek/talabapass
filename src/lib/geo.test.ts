import { describe, expect, it } from "vitest";
import { distanceKm, formatKm, isValidPoint } from "./geo";

describe("masofa", () => {
  it("Chilonzor — Yunusobod markazi ~ 12 km", () => {
    const km = distanceKm({ lat: 41.2756, lng: 69.2034 }, { lat: 41.3647, lng: 69.2863 });
    expect(km).toBeGreaterThan(11.5);
    expect(km).toBeLessThan(12.5);
  });

  it("bir nuqta — 0", () => {
    expect(distanceKm({ lat: 41.3, lng: 69.2 }, { lat: 41.3, lng: 69.2 })).toBe(0);
  });

  it("format", () => {
    expect(formatKm(0.62)).toBe("0.6 km");
    expect(formatKm(0.01)).toBe("0.1 km");
    expect(formatKm(3)).toBe("3.0 km");
    expect(formatKm(12.4)).toBe("12 km");
  });

  it("noto'g'ri koordinatalar", () => {
    expect(isValidPoint({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidPoint({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidPoint({ lat: 41.3, lng: 69.2 })).toBe(true);
  });
});
