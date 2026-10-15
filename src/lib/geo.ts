/** Geografik hisob-kitoblar — klient va server umumiy. */

export type Point = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Ikki nuqta orasidagi masofa (km), to'g'ri chiziq bo'yicha (haversine). */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 0.62 → "0.6 km"; 0.03 → "0.1 km" (0 ko'rsatilmaydi); 12.4 → "12 km". */
export function formatKm(km: number): string {
  if (km >= 10) return `${Math.round(km)} km`;
  return `${Math.max(0.1, Math.round(km * 10) / 10).toFixed(1)} km`;
}

/** Toshkent atrofidagi oqilona koordinatalar (cookie'dan kelgan qiymatni tekshirish uchun). */
export function isValidPoint(p: Point): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}
