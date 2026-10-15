import "server-only";
import { busiestWindow, deltaVs, heatKey, hourRange, pct, periodRange, quietestWeekday, type Delta, type HeatGrid, type Period } from "@/lib/stats";
import { toTashkent } from "@/lib/time";
import type { BusinessStatus, DiscountStatus, DiscountType } from "@/generated/prisma/client";
import { db } from "../db";

const HEAT_DAYS = 30;
const CASHIER_DAYS = 30;
const RECENT_SALES = 6;
const UNIVERSITIES_SHOWN = 5;
const day = (date: Date) => date.toISOString().slice(0, 10);

/** Statistika ko'rinadigan biznes: egasining tasdiqlangan (APPROVED/WARNED) biznesi. */
export async function ownerStatsBusiness(ownerId: string) {
  return db.business.findFirst({
    where: { ownerId, status: { in: ["APPROVED", "WARNED"] satisfies BusinessStatus[] }, submittedAt: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, district: { select: { name: true } } },
  });
}

export type StatsBar = { key: string; count: number; current: boolean };
export type StatsOffer = {
  id: string;
  title: string;
  type: DiscountType;
  percent: number | null;
  originalPrice: number | null;
  newPrice: number | null;
  status: DiscountStatus;
  ended: boolean;
  views: number;
  qr: number;
  sold: number;
  revenue: number;
  discount: number;
};
export type StatsSale = { id: string; at: Date; receiptNo: number; student: string; university: string; item: string; cashier: string; paid: number };

const short = (first?: string | null, last?: string | null) => [first, last ? `${last.charAt(0)}.` : null].filter(Boolean).join(" ");

/**
 * B6 ko'rsatkichlari. Barcha kunlar/soatlar Toshkent vaqtida (`periodRange`); hamma raqam bitta biznesga
 * (`businessId`) cheklangan — begona biznes ma'lumoti aralashmaydi.
 */
export async function businessStats(businessId: string, period: Period, now = new Date()) {
  const range = periodRange(period, now);
  const { from, to, prevFrom, prevTo } = range;
  const heatFrom = periodRange(HEAT_DAYS, now).from;
  const cashierFrom = periodRange(CASHIER_DAYS, now).from;
  const fromDay = range.days[0]!;
  const toDay = range.days[range.days.length - 1]!;
  const hourly = period === 1;

  const [kpi, previous, fresh, students, series, heat, universities, views, qr, offerRows, recent, cashiers, rejected, discounts] = await Promise.all([
    db.redemption.aggregate({
      where: { businessId, createdAt: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { paidAmount: true, discountAmount: true },
    }),
    db.redemption.count({ where: { businessId, createdAt: { gte: prevFrom, lt: prevTo } } }),
    // Yangi mijoz: shu biznesdagi birinchi xaridi davr ichida
    db.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM (
        SELECT "studentId", MIN("createdAt") AS first FROM "Redemption" WHERE "businessId" = ${businessId} GROUP BY "studentId"
      ) s WHERE s.first >= ${from} AND s.first < ${to}`,
    // Davrdagi talabalar va ulardan qayta kelganlari (shu biznesda davr oxirigacha 2 va undan ko'p xarid)
    db.$queryRaw<{ total: number; returning: number }[]>`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE s.visits >= 2)::int AS returning FROM (
        SELECT "studentId",
               COUNT(*) AS visits,
               COUNT(*) FILTER (WHERE "createdAt" >= ${from}) AS inside
        FROM "Redemption" WHERE "businessId" = ${businessId} AND "createdAt" < ${to} GROUP BY "studentId"
      ) s WHERE s.inside > 0`,
    hourly
      ? db.$queryRaw<{ key: string; n: number }[]>`
          SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'))::int::text AS key, COUNT(*)::int AS n
          FROM "Redemption" WHERE "businessId" = ${businessId} AND "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1`
      : db.$queryRaw<{ key: string; n: number }[]>`
          SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'), 'YYYY-MM-DD') AS key, COUNT(*)::int AS n
          FROM "Redemption" WHERE "businessId" = ${businessId} AND "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1`,
    db.$queryRaw<{ weekday: number; hour: number; n: number }[]>`
      SELECT (EXTRACT(ISODOW FROM ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'))::int - 1) AS weekday,
             EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'))::int AS hour,
             COUNT(*)::int AS n
      FROM "Redemption" WHERE "businessId" = ${businessId} AND "createdAt" >= ${heatFrom} AND "createdAt" < ${to} GROUP BY 1, 2`,
    db.$queryRaw<{ name: string; n: number }[]>`
      SELECT u."shortName" AS name, COUNT(*)::int AS n
      FROM "Redemption" r JOIN "StudentProfile" p ON p."userId" = r."studentId" JOIN "University" u ON u.id = p."universityId"
      WHERE r."businessId" = ${businessId} AND r."createdAt" >= ${from} AND r."createdAt" < ${to}
      GROUP BY u.id, u."shortName" ORDER BY n DESC, u."shortName"`,
    db.discountView.aggregate({ where: { discount: { businessId }, date: { gte: fromDay, lte: toDay } }, _sum: { count: true } }),
    db.coupon.count({ where: { discount: { businessId }, createdAt: { gte: from, lt: to } } }),
    db.$queryRaw<{ discountId: string; views: number; qr: number; sold: number; revenue: number; discount: number }[]>`
      SELECT d.id AS "discountId",
             COALESCE((SELECT SUM(v.count) FROM "DiscountView" v WHERE v."discountId" = d.id AND v.date >= ${fromDay} AND v.date <= ${toDay}), 0)::int AS views,
             (SELECT COUNT(*) FROM "Coupon" c WHERE c."discountId" = d.id AND c."createdAt" >= ${from} AND c."createdAt" < ${to})::int AS qr,
             (SELECT COUNT(*) FROM "Redemption" r WHERE r."discountId" = d.id AND r."createdAt" >= ${from} AND r."createdAt" < ${to})::int AS sold,
             COALESCE((SELECT SUM(r."paidAmount") FROM "Redemption" r WHERE r."discountId" = d.id AND r."createdAt" >= ${from} AND r."createdAt" < ${to}), 0)::int AS revenue,
             COALESCE((SELECT SUM(r."discountAmount") FROM "Redemption" r WHERE r."discountId" = d.id AND r."createdAt" >= ${from} AND r."createdAt" < ${to}), 0)::int AS discount
      FROM "Discount" d WHERE d."businessId" = ${businessId}`,
    db.redemption.findMany({
      where: { businessId },
      orderBy: [{ createdAt: "desc" }, { receiptNo: "desc" }],
      take: RECENT_SALES,
      select: {
        id: true,
        createdAt: true,
        receiptNo: true,
        paidAmount: true,
        student: { select: { firstName: true, lastName: true, student: { select: { university: { select: { shortName: true } } } } } },
        cashier: { select: { firstName: true, lastName: true } },
        coupon: { select: { termsTitle: true } },
      },
    }),
    db.redemption.groupBy({ by: ["cashierId"], where: { businessId, createdAt: { gte: cashierFrom, lt: to } }, _count: { _all: true } }),
    db.scanAttempt.count({ where: { businessId, result: { not: "OK" }, createdAt: { gte: cashierFrom, lt: to } } }),
    db.discount.findMany({
      where: { businessId, status: { not: "DRAFT" } },
      select: { id: true, title: true, type: true, percent: true, originalPrice: true, newPrice: true, status: true, endsOn: true },
    }),
  ]);

  // ── jami
  const sold = kpi._count._all;
  const revenue = kpi._sum.paidAmount ?? 0;
  const freshCount = fresh[0]?.n ?? 0;
  const distinctStudents = students[0]?.total ?? 0;
  const returningStudents = students[0]?.returning ?? 0;
  const delta: Delta = deltaVs(period, sold, previous);

  // ── grafik
  const counts = new Map(series.map((s) => [s.key, s.n]));
  const nowHour = Math.floor(toTashkent(now).minute / 60);
  const bars: StatsBar[] = hourly
    ? hourRange([...counts.keys()].map(Number)).map((h) => ({ key: String(h), count: counts.get(String(h)) ?? 0, current: h === nowHour }))
    : range.days.map((d, i) => ({ key: day(d), count: counts.get(day(d)) ?? 0, current: i === range.days.length - 1 }));

  // ── issiqlik xaritasi
  const grid: HeatGrid = new Map(heat.map((h) => [heatKey(h.weekday, h.hour), h.n]));
  const heatHours = hourRange(heat.map((h) => h.hour));

  // ── universitetlar: eng ko'p 5 ta + qolganlari ("" — "Boshqalar")
  const topUniversities = universities.slice(0, UNIVERSITIES_SHOWN).map((u) => ({ name: u.name, count: u.n }));
  const rest = universities.slice(UNIVERSITIES_SHOWN).reduce((sum, u) => sum + u.n, 0);
  if (rest > 0) topUniversities.push({ name: "", count: rest });

  // ── chegirmalar jadvali: davrda faoliyati bor yoki hozir faol
  const stat = new Map(offerRows.map((r) => [r.discountId, r]));
  const today = toTashkent(now).date;
  const offers: StatsOffer[] = discounts
    .map((d): StatsOffer => {
      const s = stat.get(d.id);
      return {
        id: d.id,
        title: d.title,
        type: d.type,
        percent: d.percent,
        originalPrice: d.originalPrice,
        newPrice: d.newPrice,
        status: d.status,
        ended: d.status === "ENDED" || d.endsOn < today,
        views: s?.views ?? 0,
        qr: s?.qr ?? 0,
        sold: s?.sold ?? 0,
        revenue: s?.revenue ?? 0,
        discount: s?.discount ?? 0,
      };
    })
    .filter((o) => o.views > 0 || o.qr > 0 || o.sold > 0 || (o.status === "ACTIVE" && !o.ended))
    .sort((a, b) => b.sold - a.sold || b.views - a.views);
  const offerTotals = offers.reduce(
    (t, o) => ({ views: t.views + o.views, qr: t.qr + o.qr, sold: t.sold + o.sold, revenue: t.revenue + o.revenue, discount: t.discount + o.discount }),
    { views: 0, qr: 0, sold: 0, revenue: 0, discount: 0 },
  );

  // ── kassirlar (30 kun)
  const cashierUsers = await db.user.findMany({ where: { id: { in: cashiers.map((c) => c.cashierId) } }, select: { id: true, firstName: true, lastName: true, phone: true } });
  const names = new Map(cashierUsers.map((u) => [u.id, short(u.firstName, u.lastName) || u.phone]));
  const cashierRows = cashiers.map((c) => ({ name: names.get(c.cashierId) ?? "—", count: c._count._all })).sort((a, b) => b.count - a.count);

  return {
    period,
    kpi: {
      sold,
      delta,
      revenue,
      average: sold > 0 ? Math.round(revenue / sold) : 0,
      discount: kpi._sum.discountAmount ?? 0,
      fresh: freshCount,
      returningPercent: pct(returningStudents, distinctStudents),
    },
    chart: { hourly, bars },
    funnel: { views: views._sum.count ?? 0, qr, sold },
    heat: { hours: heatHours, grid, busiest: busiestWindow(grid, heatHours), quietest: quietestWeekday(grid) },
    universities: topUniversities,
    offers,
    offerTotals,
    sales: recent.map(
      (r): StatsSale => ({
        id: r.id,
        at: r.createdAt,
        receiptNo: r.receiptNo,
        student: short(r.student.firstName, r.student.lastName),
        university: r.student.student?.university.shortName ?? "",
        item: r.coupon.termsTitle,
        cashier: short(r.cashier.firstName, r.cashier.lastName),
        paid: r.paidAmount,
      }),
    ),
    cashiers: { rows: cashierRows, rejected },
  };
}
export type BusinessStats = Awaited<ReturnType<typeof businessStats>>;
