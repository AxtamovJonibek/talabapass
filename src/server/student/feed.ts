import "server-only";
import { discountTerms } from "@/lib/discount";
import { discountImageUrl, type FeedDeal } from "@/lib/feed";
import { businessLogoUrl } from "@/lib/profile-image";
import { distanceKm, type Point } from "@/lib/geo";
import { dealTiming, fromTashkent, toTashkent, type DealTiming } from "@/lib/time";
import type { BusinessStatus, Prisma } from "@/generated/prisma/client";
import { db } from "../db";

/** Talabaga ko'rinadigan biznes: tasdiqlangan (ogohlantirilgan ham — u tasdiqlangan hamkor bo'lib qoladi). */
export const LIVE_BUSINESS_STATUSES: BusinessStatus[] = ["APPROVED", "WARNED"];

const DAY_MS = 86_400_000;
/** Lentaga chiqadigan eng ko'p chegirma (shahar bo'yicha) */
const FEED_LIMIT = 500;

/**
 * Talabaga ko'rinadigan chegirmalar: admin tasdiqlagan (ACTIVE), biznesi tasdiqlangan va egasi bloklanmagan,
 * muddati tugamagan. Kecha tugagan chegirmaning tungi oralig'i (22:00–02:00) bugun ham davom etishi mumkin.
 */
export function visibleDiscountWhere(now: Date): Prisma.DiscountWhereInput {
  const yesterday = new Date(toTashkent(now).date.getTime() - DAY_MS);
  return {
    status: "ACTIVE",
    endsOn: { gte: yesterday },
    business: { status: { in: LIVE_BUSINESS_STATUSES }, owner: { status: "ACTIVE" } },
  };
}

const DEAL_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  originalPrice: true,
  percent: true,
  newPrice: true,
  note: true,
  icon: true,
  tileColor: true,
  inkColor: true,
  weekdays: true,
  fromMinute: true,
  toMinute: true,
  dailyLimit: true,
  perStudentLimit: true,
  startsOn: true,
  endsOn: true,
  terms: true,
  createdAt: true,
  images: { select: { id: true }, orderBy: { sort: "asc" } },
  category: { select: { slug: true, icon: true, tileColor: true, inkColor: true } },
  business: {
    select: {
      id: true,
      logoKey: true,
      publicPhone: true,
      telegram: true,
      instagram: true,
      name: true,
      typeLabel: true,
      address: true,
      landmark: true,
      lat: true,
      lng: true,
      workingHours: true,
      district: { select: { name: true } },
    },
  },
} satisfies Prisma.DiscountSelect;

type DealRow = Prisma.DiscountGetPayload<{ select: typeof DEAL_SELECT }>;

function toFeedDeal(row: DealRow, timing: DealTiming, claimed: number, origin: Point | null, now: Date): FeedDeal {
  const terms = discountTerms(row);
  // 100% chegirmada narx 0 — narx o'rniga "Bepul" yozuvi (badge asosida)
  const priced = row.type !== "BOGO" && terms.finalPrice !== null && terms.finalPrice > 0;
  const point = row.business.lat !== null && row.business.lng !== null ? { lat: row.business.lat, lng: row.business.lng } : null;
  const percent =
    row.type === "BOGO" ? 50 : row.type === "PERCENT" ? (row.percent ?? 0) : Math.round((1 - (row.newPrice ?? 0) / Math.max(1, row.originalPrice ?? 1)) * 100);
  return {
    id: row.id,
    title: row.title,
    businessId: row.business.id,
    store: row.business.name,
    typeLabel: row.business.typeLabel,
    district: row.business.district?.name ?? null,
    category: row.category.slug,
    icon: row.icon ?? row.category.icon,
    images: row.images.map((i) => discountImageUrl(i.id)),
    tile: row.tileColor ?? row.category.tileColor,
    ink: row.inkColor ?? row.category.inkColor,
    badge: terms.badge,
    price: priced ? { now: terms.finalPrice!, old: terms.originalPrice } : null,
    note: priced ? null : row.note,
    percent,
    fromMinute: row.fromMinute,
    toMinute: row.toMinute,
    live: timing.live,
    closesAt: timing.live ? timing.closesAt.toISOString() : null,
    opensAt: timing.live ? null : timing.opensAt.toISOString(),
    lastDay: row.endsOn.getTime() === toTashkent(now).date.getTime(),
    left: Math.max(0, row.dailyLimit - claimed),
    total: row.dailyLimit,
    point,
    distanceKm: origin && point ? distanceKm(origin, point) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Ko'rinadigan qatorlar + har birining holati (ochiq / keyingi oraliq) va o'sha kundagi real qoldiq. */
async function loadDeals(where: Prisma.DiscountWhereInput, now: Date, origin: Point | null) {
  const rows = await db.discount.findMany({
    where: { AND: [visibleDiscountWhere(now), where] },
    select: DEAL_SELECT,
    orderBy: { createdAt: "desc" },
    take: FEED_LIMIT,
  });

  const timed = rows.flatMap((row) => {
    const timing = dealTiming(row, now);
    return timing ? [{ row, timing }] : [];
  });
  if (timed.length === 0) return [];

  // Kunlik hisob oraliq boshlangan sanaga yoziladi (kupon olishdagi bilan bir xil)
  const dates = [...new Set(timed.map((x) => x.timing.windowDate.getTime()))].map((t) => new Date(t));
  const days = await db.discountDay.findMany({
    where: { discountId: { in: timed.map((x) => x.row.id) }, date: { in: dates } },
    select: { discountId: true, date: true, claimed: true },
  });
  const claimed = new Map(days.map((d) => [`${d.discountId}:${d.date.getTime()}`, d.claimed]));

  return timed.map(({ row, timing }) => ({
    row,
    deal: toFeedDeal(row, timing, claimed.get(`${row.id}:${timing.windowDate.getTime()}`) ?? 0, origin, now),
  }));
}

export async function feedDeals(now: Date, origin: Point | null): Promise<FeedDeal[]> {
  return (await loadDeals({}, now, origin)).map((x) => x.deal);
}

export type NearbyDeal = Pick<FeedDeal, "id" | "badge" | "store" | "live" | "opensAt"> & { distanceKm: number };

export type DealDetail = {
  deal: FeedDeal;
  description: string | null;
  terms: string | null;
  weekdays: number[];
  fromMinute: number;
  toMinute: number;
  perStudentLimit: DealRow["perStudentLimit"];
  /** "YYYY-MM-DD" */
  endsOn: string;
  business: { name: string; logoUrl: string | null; phone: string | null; telegram: string | null; instagram: string | null; typeLabel: string | null; district: string | null; address: string; landmark: string | null; workingHours: string; point: Point | null };
  /** Shu joyga yaqin boshqa chegirmalar (WT3 "Yaqin atrofda") */
  nearby: NearbyDeal[];
};

/** Bitta chegirma (T5 / WT3). Talabaga ko'rinmaydigan (tasdiqlanmagan, tugagan, biznesi bloklangan) — null. */
export async function dealDetail(id: string, now: Date, origin: Point | null): Promise<DealDetail | null> {
  const [found] = await loadDeals({ id }, now, origin);
  if (!found) return null;
  const { row, deal } = found;

  let nearby: NearbyDeal[] = [];
  if (deal.point) {
    const here = deal.point;
    // Boshqa joylar: shu biznesning o'z chegirmalari emas
    const others = await loadDeals({ businessId: { not: deal.businessId }, business: { lat: { not: null }, lng: { not: null } } }, now, origin);
    nearby = others
      .map(({ deal: d }) => ({ id: d.id, badge: d.badge, store: d.store, live: d.live, opensAt: d.opensAt, distanceKm: distanceKm(here, d.point!) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }

  return {
    deal,
    description: row.description,
    terms: row.terms,
    weekdays: row.weekdays,
    fromMinute: row.fromMinute,
    toMinute: row.toMinute,
    perStudentLimit: row.perStudentLimit,
    endsOn: row.endsOn.toISOString().slice(0, 10),
    business: {
      name: row.business.name,
      logoUrl: businessLogoUrl(row.business.id, row.business.logoKey),
      phone: row.business.publicPhone,
      telegram: row.business.telegram,
      instagram: row.business.instagram,
      typeLabel: row.business.typeLabel,
      district: row.business.district?.name ?? null,
      address: row.business.address,
      landmark: row.business.landmark,
      workingHours: row.business.workingHours,
      point: deal.point,
    },
    nearby,
  };
}

/** Ko'rishlar hisobi (B6 voronkasi) — Toshkent kuni bo'yicha. */
export async function countView(discountId: string, now: Date) {
  const date = toTashkent(now).date;
  await db.discountView.upsert({
    where: { discountId_date: { discountId, date } },
    create: { discountId, date, count: 1 },
    update: { count: { increment: 1 } },
  });
}

/** Talaba shu oyda qancha tejadi (WT2 sarlavhasi). */
export async function savedThisMonth(studentId: string, now: Date): Promise<number> {
  const today = toTashkent(now).date;
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const sum = await db.redemption.aggregate({
    where: { studentId, createdAt: { gte: fromTashkent(monthStart) } },
    _sum: { discountAmount: true },
  });
  return sum._sum.discountAmount ?? 0;
}

export async function isSaved(studentId: string, discountId: string): Promise<boolean> {
  return (await db.savedDiscount.count({ where: { studentId, discountId } })) > 0;
}

export async function hasUnreadNotifications(userId: string): Promise<boolean> {
  return (await db.userNotification.count({ where: { userId, readAt: null } })) > 0;
}
