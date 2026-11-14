import { distanceKm, type Point } from "../geo";

/**
 * Toshkent metrosi bekatlari (statik). Koordinatalar: Wikidata (`metro station`, O'zbekiston, P625), 2026-11-14 da bir marta
 * olingan — OpenStreetMap Overpass ishlab chiqish muhitidan ochilmadi. Nomlar — hozirgi o'zbekcha nomlar (Wikidata'dagi
 * o'zbekcha yorliq bir nechta bekatda boshqa/eski nom edi — ruscha yorliq bo'yicha tuzatildi). Koordinatasi shubhali — `UNVERIFIED`.
 * Avtobus marshrutlari saqlanmaydi: jamoat transporti tanlansa Yandex/Google o'zi ko'rsatadi.
 */
export type MetroStation = { name: string; lat: number; lng: number };

export const METRO_STATIONS: readonly MetroStation[] = [
  // Chilonzor yo'li
  { name: "Olmazor", lat: 41.255611, lng: 69.196014 },
  { name: "Chilonzor", lat: 41.274547, lng: 69.204739 },
  { name: "Mirzo Ulug'bek", lat: 41.282081, lng: 69.212453 },
  { name: "Novza", lat: 41.292028, lng: 69.223342 },
  { name: "Milliy bog'", lat: 41.304281, lng: 69.235414 },
  { name: "Bunyodkor", lat: 41.311881, lng: 69.241392 },
  { name: "Paxtakor", lat: 41.31779, lng: 69.25508 },
  { name: "Mustaqillik maydoni", lat: 41.31495, lng: 69.27106 },
  { name: "Amir Temur xiyoboni", lat: 41.312164, lng: 69.28145 },
  { name: "Hamid Olimjon", lat: 41.31777, lng: 69.294878 },
  { name: "Pushkin", lat: 41.321708, lng: 69.311244 },
  { name: "Buyuk Ipak yo'li", lat: 41.326344, lng: 69.327769 },
  // Chilonzor yo'li davomi (Sirg'ali tomon)
  { name: "Choshtepa", lat: 41.238809, lng: 69.195679 },
  { name: "O'zgarish", lat: 41.22727, lng: 69.20404 },
  { name: "Sirg'ali", lat: 41.221042, lng: 69.208555 },
  { name: "Yangihayot", lat: 41.21269, lng: 69.21467 },
  { name: "Chinor", lat: 41.20601, lng: 69.2195 },
  // O'zbekiston yo'li
  { name: "Beruniy", lat: 41.345428, lng: 69.206767 },
  { name: "Tinchlik", lat: 41.331861, lng: 69.219925 },
  { name: "Chorsu", lat: 41.325239, lng: 69.232064 },
  { name: "G'afur G'ulom", lat: 41.327831, lng: 69.246981 },
  { name: "Alisher Navoiy", lat: 41.321125, lng: 69.254714 },
  { name: "O'zbekiston", lat: 41.311397, lng: 69.253408 },
  { name: "Kosmonavtlar", lat: 41.305022, lng: 69.265344 },
  { name: "Oybek", lat: 41.298686, lng: 69.273333 },
  { name: "Toshkent", lat: 41.292136, lng: 69.28615 },
  { name: "Mashinasozlar", lat: 41.299439, lng: 69.303947 },
  { name: "Do'stlik", lat: 41.293539, lng: 69.322686 },
  // Yunusobod yo'li
  { name: "Turkiston", lat: 41.37751, lng: 69.29602 },
  { name: "Yunusobod", lat: 41.36664, lng: 69.29211 },
  { name: "Shahriston", lat: 41.353836, lng: 69.288197 },
  { name: "Bodomzor", lat: 41.3462, lng: 69.28595 },
  { name: "Minor", lat: 41.328094, lng: 69.283661 },
  { name: "Abdulla Qodiriy", lat: 41.319411, lng: 69.282458 },
  { name: "Yunus Rajabiy", lat: 41.312311, lng: 69.281042 },
  { name: "Ming O'rik", lat: 41.298992, lng: 69.273019 },
  // Halqa yo'li
  { name: "Texnopark", lat: 41.294573, lng: 69.323376 },
  { name: "Yashnobod", lat: 41.297759, lng: 69.349739 },
  { name: "Tuzel", lat: 41.292056, lng: 69.35617 },
  { name: "Olmos", lat: 41.281982, lng: 69.360324 },
  { name: "Rohat", lat: 41.265536, lng: 69.36492 },
  { name: "Yangiobod", lat: 41.255464, lng: 69.358087 },
  { name: "Qo'yliq", lat: 41.237391, lng: 69.327458 },
  { name: "Matonat", lat: 41.244451, lng: 69.308345 },
  { name: "Qiyot", lat: 41.24447, lng: 69.299643 },
  { name: "Tolariq", lat: 41.244498, lng: 69.284877 },
  { name: "Xonobod", lat: 41.23001, lng: 69.270435 },
  { name: "Quruvchilar", lat: 41.221359, lng: 69.259825 },
  { name: "Turon", lat: 41.21069, lng: 69.23417 },
  { name: "Qipchoq", lat: 41.20539, lng: 69.22136 },
];

/** Koordinatasi tekshirilmagan (bir xil kenglikda tekis joylashgan — taxminiy kiritilganga o'xshaydi) */
export const UNVERIFIED = ["Matonat", "Qiyot", "Tolariq"] as const;

/** Shundan uzoq bekat ko'rsatilmaydi */
export const METRO_MAX_KM = 1.5;

/** Eng yaqin bekat (haversine) — 1.5 km dan uzoq bo'lsa null. */
export function nearestMetro(point: Point): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const s of METRO_STATIONS) {
    const km = distanceKm(point, s);
    if (!best || km < best.km) best = { name: s.name, km };
  }
  return best && best.km <= METRO_MAX_KM ? best : null;
}

/** Metrogacha masofa: 100 m ga yaxlitlanadi ("600 m"), 1 km dan oshsa "1.2 km". */
export function formatMetroDistance(km: number): string {
  const m = Math.max(100, Math.round((km * 1000) / 100) * 100);
  return m >= 1000 ? `${Number((m / 1000).toFixed(1))} km` : `${m} m`;
}
