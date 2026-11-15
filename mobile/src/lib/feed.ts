import type { FeedDeal } from "@/api/endpoints";

/**
 * Lenta filtri va saralashi — saytdagi `src/lib/feed.ts` bilan bir xil (sayt ham brauzerda filtrlaydi: tez almashadi).
 * Server bir marta hammasini beradi, qidiruv/kategoriya/"Hozir ochiq"/saralash qurilmada.
 */

export const SORTS = ["near", "biggest", "ending", "new"] as const;
export type FeedSort = (typeof SORTS)[number];

export type FeedFilters = { q: string; category: string; liveOnly: boolean };

/** Kichik harf, o'zbekcha tutuq belgilarining barcha ko'rinishlari bitta. */
export function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesQuery(deal: FeedDeal, query: string, categoryName = ""): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const haystack = normalizeQuery([deal.title, deal.store, deal.typeLabel, deal.district, deal.note, categoryName].filter(Boolean).join(" "));
  return q.split(" ").every((word) => haystack.includes(word));
}

export function filterDeals(deals: FeedDeal[], filters: FeedFilters, categoryName: (slug: string) => string = () => ""): FeedDeal[] {
  return deals.filter(
    (d) => (filters.category === "all" || d.category === filters.category) && (!filters.liveOnly || d.live) && matchesQuery(d, filters.q, categoryName(d.category)),
  );
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);
/** Ochiqlar oldin; ichida — tezroq yopiladigani, yopiqlarda — tezroq ochiladigani. */
const bySoonest = (a: FeedDeal, b: FeedDeal) => Number(b.live) - Number(a.live) || time(a.live ? a.closesAt : a.opensAt) - time(b.live ? b.closesAt : b.opensAt);

export function sortDeals(deals: FeedDeal[], sort: FeedSort): FeedDeal[] {
  const list = [...deals];
  switch (sort) {
    case "near":
      return list.sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) || bySoonest(a, b));
    case "biggest":
      return list.sort((a, b) => b.percent - a.percent || bySoonest(a, b));
    case "ending":
      return list.sort((a, b) => bySoonest(a, b) || a.left / Math.max(1, a.total) - b.left / Math.max(1, b.total));
    case "new":
      return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

/** "Tez tugaydi" chegaralari (sayt: `CLOSING_SOON_MIN`, `LOW_STOCK`) */
const CLOSING_SOON_MIN = 120;
const LOW_STOCK = { min: 10, ratio: 0.15 } as const;

/**
 * Zaxira oz (saytdagi `urgencyOf` → `lowStock`, `useDealMarks`): faqat hozir ochiq, qoldig'i bor va yopilishiga
 * 2 soatdan ko'p qolgan chegirmada — kartada "Tez tugayapti · 2/20" yorlig'i.
 */
export function isLowStock(deal: Pick<FeedDeal, "live" | "left" | "total" | "closesAt">, now: Date): boolean {
  if (!deal.live || deal.left <= 0 || !deal.closesAt) return false;
  const minutes = Math.ceil((Date.parse(deal.closesAt) - now.getTime()) / 60_000);
  if (minutes <= CLOSING_SOON_MIN) return false;
  return deal.left <= Math.max(LOW_STOCK.min, Math.ceil(deal.total * LOW_STOCK.ratio));
}
