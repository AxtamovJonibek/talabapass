import "server-only";
import type { FeedDeal } from "@/lib/feed";
import type { LandingStats } from "@/lib/landing";
import { db } from "./db";
import { businessLogoUrl } from "@/lib/profile-image";
import { LIVE_BUSINESS_STATUSES, feedDeals, visibleDiscountWhere } from "./student/feed";

/** Hamkor sifatida ko'rsatiladigan biznes: tasdiqlangan va egasi hisobini o'chirmagan (`account.ts`). */
const PARTNER_WHERE = { status: { in: LIVE_BUSINESS_STATUSES }, owner: { status: { not: "DELETED" as const } } };

/** "Raqamlarda": tasdiqlangan talabalar, hamkorlar, faol chegirmalar, jami tejalgan summa (barcha cheklar). */
export async function landingStats(now: Date): Promise<LandingStats> {
  const [students, businesses, discounts, saved] = await Promise.all([
    db.studentProfile.count({ where: { status: "APPROVED", user: { status: "ACTIVE" } } }),
    db.business.count({ where: PARTNER_WHERE }),
    db.discount.count({ where: visibleDiscountWhere(now) }),
    db.redemption.aggregate({ where: { voidedAt: null }, _sum: { discountAmount: true } }),
  ]);
  return { students, businesses, discounts, savedTotal: saved._sum.discountAmount ?? 0 };
}

/** Admin sozlamalari (`/admin/landing`): qator yo'q — hammasi avtomatik */
export async function landingSettings() {
  return (
    (await db.landingSettings.findUnique({ where: { id: "landing" } })) ?? {
      id: "landing",
      statsMode: "AUTO" as const,
      statsStudents: null,
      statsBusinesses: null,
      statsDiscounts: null,
      statsSaved: null,
      dealsMode: "AUTO" as const,
      dealIds: [] as string[],
      updatedAt: new Date(0),
    }
  );
}

/**
 * "Raqamlarda" bo'limi admin rejimi bilan: AUTO — bazadan (`STATS_MIN` dan kichik bo'lsa yashiriladi), MANUAL — admin
 * kiritgan raqamlar (bo'sh maydon — bazadagisi), doim ko'rsatiladi (`force`), HIDDEN — bo'lim yo'q.
 */
export async function landingStatsSection(now: Date): Promise<{ stats: LandingStats; force: boolean } | null> {
  const settings = await landingSettings();
  if (settings.statsMode === "HIDDEN") return null;
  const auto = await landingStats(now);
  if (settings.statsMode === "AUTO") return { stats: auto, force: false };
  return {
    force: true,
    stats: {
      students: settings.statsStudents ?? auto.students,
      businesses: settings.statsBusinesses ?? auto.businesses,
      discounts: settings.statsDiscounts ?? auto.discounts,
      savedTotal: settings.statsSaved ?? auto.savedTotal,
    },
  };
}

const PARTNERS_SHOWN = 8;
const UNIVERSITIES_SHOWN = 6;

export type LandingPartnerView = { key: string; name: string; logoUrl: string | null };

/**
 * Hamkorlar: tasdiqlangan bizneslar (egasi hisobini o'chirganlari yo'q) va admin qo'lda qo'shganlari. Admin yashirgani
 * chiqmaydi; tartib — admin bergan `sort` (kichigi oldin), keyin oxirgi tasdiqlanganlari. Logotip — admin yuklagani,
 * bo'lmasa biznes logotipi. Oliygohlar — tasdiqlangan talabasi borlari.
 */
export async function landingPartners(): Promise<{ businesses: LandingPartnerView[]; universities: string[] }> {
  const [businesses, overrides, universities] = await Promise.all([
    db.business.findMany({
      where: PARTNER_WHERE,
      orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      take: 60,
      select: { id: true, name: true, logoKey: true },
    }),
    db.landingPartner.findMany({ select: { id: true, businessId: true, name: true, logoKey: true, sort: true, hidden: true } }),
    db.university.findMany({
      where: { students: { some: { status: "APPROVED" } } },
      orderBy: { students: { _count: "desc" } },
      take: UNIVERSITIES_SHOWN,
      select: { shortName: true },
    }),
  ]);
  const byBusiness = new Map(overrides.filter((o) => o.businessId).map((o) => [o.businessId!, o]));
  const partnerLogo = (o: { id: string; logoKey: string | null }) => (o.logoKey ? `/api/landing/hamkor/${o.id}?v=${o.logoKey.slice(-12, -4)}` : null);
  const rows = [
    ...businesses.map((b, i) => {
      const o = byBusiness.get(b.id);
      return { key: b.id, name: b.name, hidden: o?.hidden ?? false, sort: o?.sort ?? 0, order: i, logoUrl: (o ? partnerLogo(o) : null) ?? businessLogoUrl(b.id, b.logoKey) };
    }),
    ...overrides.filter((o) => !o.businessId).map((o, i) => ({ key: o.id, name: o.name, hidden: o.hidden, sort: o.sort, order: businesses.length + i, logoUrl: partnerLogo(o) })),
  ];
  const shown = rows
    .filter((r) => !r.hidden)
    .sort((a, b) => a.sort - b.sort || a.order - b.order)
    .slice(0, PARTNERS_SHOWN)
    .map(({ key, name, logoUrl }) => ({ key, name, logoUrl }));
  return { businesses: shown, universities: universities.map((u) => u.shortName) };
}

/**
 * "Hozir Toshkentda ochiq". AUTO — avval hozir ochiqlari (tezroq yopiladigani oldin), yetmasa — eng yaqinda ochiladiganlari;
 * MANUAL — admin tanlaganlari (talabaga ko'rinadiganlari, tanlangan tartibda); MIXED — avval tanlanganlar, qolgani avtomatik.
 */
export async function landingDeals(now: Date, count = 4): Promise<FeedDeal[]> {
  const [deals, settings] = await Promise.all([feedDeals(now, null), landingSettings()]);
  const at = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);
  const live = deals.filter((d) => d.live && d.left > 0).sort((a, b) => at(a.closesAt) - at(b.closesAt));
  const later = deals.filter((d) => !d.live).sort((a, b) => at(a.opensAt) - at(b.opensAt));
  const auto = [...live, ...later];
  if (settings.dealsMode === "AUTO") return auto.slice(0, count);
  const byId = new Map(deals.map((d) => [d.id, d]));
  const picked = settings.dealIds.map((id) => byId.get(id)).filter((d): d is FeedDeal => Boolean(d));
  if (settings.dealsMode === "MANUAL") return picked.slice(0, count);
  const pickedIds = new Set(picked.map((d) => d.id));
  return [...picked, ...auto.filter((d) => !pickedIds.has(d.id))].slice(0, count);
}
