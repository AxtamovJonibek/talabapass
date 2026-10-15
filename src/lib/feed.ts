/**
 * Talaba lentasi (T4 / WT2): qidiruv, kategoriya, "faqat hozir ochiq", saralash, "Tez tugaydi".
 * Sof funksiyalar — server ma'lumotni tayyorlaydi, filtr va saralash brauzerda (tez almashadi).
 */
import type { Point } from "./geo";

export type FeedDeal = {
  id: string;
  title: string;
  businessId: string;
  store: string;
  /** "Choyxona" */
  typeLabel: string | null;
  district: string | null;
  /** Kategoriya slug'i: taom, kofe, ... */
  category: string;
  icon: string;
  tile: string;
  ink: string;
  /** "−30%", "1+1" */
  badge: string;
  /** Narxli chegirma: talaba to'laydigan narx va asl narx (so'm) */
  price: { now: number; old: number | null } | null;
  /** Narxsiz chegirma matni: "Ikkinchi lavash bepul" */
  note: string | null;
  /** "Eng katta chegirma" saralashi uchun foiz (1+1 — 50) */
  percent: number;
  /** Oraliq (Toshkent vaqti, daqiqa): T4 "08:00–11:00" */
  fromMinute: number;
  toMinute: number;
  live: boolean;
  /** ISO; hozir ochiq bo'lsa — yopilish lahzasi */
  closesAt: string | null;
  /** ISO; yopiq bo'lsa — keyingi ochilish */
  opensAt: string | null;
  /** Aksiyaning oxirgi kuni (Toshkent sanasi bo'yicha) */
  lastDay: boolean;
  /** Joriy (yoki keyingi) oraliq kunidagi qoldiq va kunlik limit */
  left: number;
  total: number;
  point: Point | null;
  distanceKm: number | null;
  /** ISO */
  createdAt: string;
};

export const SORTS = ["near", "biggest", "ending", "new"] as const;
export type FeedSort = (typeof SORTS)[number];
export const isFeedSort = (value: unknown): value is FeedSort => SORTS.includes(value as FeedSort);

export type FeedFilters = { q: string; category: string; liveOnly: boolean };

/** Qidiruv uchun: kichik harf, o'zbekcha tutuq belgilarining barcha ko'rinishlari bitta. */
export function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** `categoryName` — kategoriya nomi bo'yicha ham topilsin ("taom" → "Taomlar"). */
export function matchesQuery(deal: FeedDeal, query: string, categoryName = ""): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const haystack = normalizeQuery([deal.title, deal.store, deal.typeLabel, deal.district, deal.note, categoryName].filter(Boolean).join(" "));
  return q.split(" ").every((word) => haystack.includes(word));
}

export function filterDeals(deals: FeedDeal[], filters: FeedFilters, categoryName: (slug: string) => string = () => ""): FeedDeal[] {
  return deals.filter(
    (d) =>
      (filters.category === "all" || d.category === filters.category) &&
      (!filters.liveOnly || d.live) &&
      matchesQuery(d, filters.q, categoryName(d.category)),
  );
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);
/** Ochiqlar oldin; ichida — tezroq yopiladigani, yopiqlarda — tezroq ochiladigani. */
const bySoonest = (a: FeedDeal, b: FeedDeal) => Number(b.live) - Number(a.live) || time(a.live ? a.closesAt : a.opensAt) - time(b.live ? b.closesAt : b.opensAt);

export function sortDeals(deals: FeedDeal[], sort: FeedSort): FeedDeal[] {
  const list = [...deals];
  switch (sort) {
    case "near":
      // Masofa noma'lum bo'lsa (joy tanlanmagan) — oxirida, o'zaro ochiqligi bo'yicha
      return list.sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) || bySoonest(a, b));
    case "biggest":
      return list.sort((a, b) => b.percent - a.percent || bySoonest(a, b));
    case "ending":
      return list.sort((a, b) => bySoonest(a, b) || a.left / Math.max(1, a.total) - b.left / Math.max(1, b.total));
    case "new":
      return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

export function categoryCounts(deals: FeedDeal[]): Record<string, number> {
  const counts: Record<string, number> = { all: deals.length };
  for (const d of deals) counts[d.category] = (counts[d.category] ?? 0) + 1;
  return counts;
}

/** "Tez tugaydi" chegaralari */
export const CLOSING_SOON_MIN = 120;
export const LOW_STOCK = { min: 10, ratio: 0.15 } as const;

export type Urgency =
  /** Oraliq yopilishiga oz qoldi */
  | { kind: "closing"; minutes: number }
  /** Bugungi qoldiq oz */
  | { kind: "lowStock" }
  /** Aksiyaning oxirgi kuni */
  | { kind: "lastDay" };

/** Nega "tez tugaydi": faqat hozir ochiq va qoldig'i bor chegirma uchun. */
export function urgencyOf(deal: FeedDeal, now: Date): Urgency | null {
  if (!deal.live || deal.left <= 0 || !deal.closesAt) return null;
  const minutes = Math.max(0, Math.ceil((Date.parse(deal.closesAt) - now.getTime()) / 60_000));
  if (minutes <= CLOSING_SOON_MIN) return { kind: "closing", minutes };
  if (deal.left <= Math.max(LOW_STOCK.min, Math.ceil(deal.total * LOW_STOCK.ratio))) return { kind: "lowStock" };
  if (deal.lastDay) return { kind: "lastDay" };
  return null;
}

/** "Tez tugaydi" qatori: shoshilinchlari, eng tez yopiladigani oldin. */
export function endingSoon(deals: FeedDeal[], now: Date, max = 3): { deal: FeedDeal; urgency: Urgency }[] {
  return deals
    .map((deal) => ({ deal, urgency: urgencyOf(deal, now) }))
    .filter((x): x is { deal: FeedDeal; urgency: Urgency } => x.urgency !== null)
    .sort((a, b) => time(a.deal.closesAt) - time(b.deal.closesAt) || a.deal.left - b.deal.left)
    .slice(0, max);
}
