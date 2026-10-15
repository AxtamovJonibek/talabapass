import "server-only";
import type { FeedDeal } from "@/lib/feed";
import type { LandingStats } from "@/lib/landing";
import { db } from "./db";
import { LIVE_BUSINESS_STATUSES, feedDeals, visibleDiscountWhere } from "./student/feed";

/** "Raqamlarda": tasdiqlangan talabalar, hamkorlar, faol chegirmalar, jami tejalgan summa (barcha cheklar). */
export async function landingStats(now: Date): Promise<LandingStats> {
  const [students, businesses, discounts, saved] = await Promise.all([
    db.studentProfile.count({ where: { status: "APPROVED", user: { status: "ACTIVE" } } }),
    db.business.count({ where: { status: { in: LIVE_BUSINESS_STATUSES } } }),
    db.discount.count({ where: visibleDiscountWhere(now) }),
    db.redemption.aggregate({ _sum: { discountAmount: true } }),
  ]);
  return { students, businesses, discounts, savedTotal: saved._sum.discountAmount ?? 0 };
}

const PARTNERS_SHOWN = 8;
const UNIVERSITIES_SHOWN = 6;

/** Hamkorlar — faqat tasdiqlangan bizneslar (oxirgi tasdiqlanganlari); oliygohlar — tasdiqlangan talabasi borlari. */
export async function landingPartners(): Promise<{ businesses: string[]; universities: string[] }> {
  const [businesses, universities] = await Promise.all([
    db.business.findMany({
      where: { status: { in: LIVE_BUSINESS_STATUSES } },
      orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      take: PARTNERS_SHOWN,
      select: { name: true },
    }),
    db.university.findMany({
      where: { students: { some: { status: "APPROVED" } } },
      orderBy: { students: { _count: "desc" } },
      take: UNIVERSITIES_SHOWN,
      select: { shortName: true },
    }),
  ]);
  return { businesses: businesses.map((b) => b.name), universities: universities.map((u) => u.shortName) };
}

/** "Hozir Toshkentda ochiq": avval hozir ochiqlari (tezroq yopiladigani oldin), yetmasa — eng yaqinda ochiladiganlari. */
export async function landingDeals(now: Date, count = 4): Promise<FeedDeal[]> {
  const deals = await feedDeals(now, null);
  const at = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);
  const live = deals.filter((d) => d.live && d.left > 0).sort((a, b) => at(a.closesAt) - at(b.closesAt));
  const later = deals.filter((d) => !d.live).sort((a, b) => at(a.opensAt) - at(b.opensAt));
  return [...live, ...later].slice(0, count);
}
