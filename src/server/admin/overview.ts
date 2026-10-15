import "server-only";
import { dayBounds, lastDays, OVERVIEW_DAYS } from "@/lib/admin-stats";
import { db } from "../db";
import { pendingCounts } from "./review";
import { visibleDiscountWhere } from "../student/feed";

/**
 * A1 — platforma ko'rsatkichlari. Barcha kunlar Toshkent vaqtida; faqat o'qish.
 * Har bir funksiya chaqiruvchi `requireRole("ADMIN")` qilgan deb hisoblaydi.
 */

const WEEK_MS = 7 * 86_400_000;
const RATING_SHOWN = 6;
const UNIVERSITIES_SHOWN = 5;

export type DaySeries = { key: string; sales: number; students: number }[];

export async function platformOverview(now = new Date()) {
  const days = lastDays(OVERVIEW_DAYS, now);
  const today = dayBounds(days[days.length - 1]!);
  const lastWeek = { from: new Date(today.from.getTime() - WEEK_MS), to: new Date(today.to.getTime() - WEEK_MS) };
  const from = dayBounds(days[0]!).from;
  const to = today.to;

  const [students, newToday, businesses, activeDiscounts, salesToday, salesLastWeek, sumToday, series, newStudents, categories, universities, queue, blocked] = await Promise.all([
    db.studentProfile.count({ where: { status: "APPROVED", user: { status: "ACTIVE" } } }),
    db.verification.groupBy({ by: ["studentId"], where: { status: "APPROVED", reviewedAt: { gte: today.from, lt: today.to } } }).then((rows) => rows.length),
    db.business.count({ where: { status: { in: ["APPROVED", "WARNED"] }, owner: { status: "ACTIVE" } } }),
    db.discount.count({ where: visibleDiscountWhere(now) }),
    db.redemption.count({ where: { createdAt: { gte: today.from, lt: today.to } } }),
    db.redemption.count({ where: { createdAt: { gte: lastWeek.from, lt: lastWeek.to } } }),
    db.redemption.aggregate({ where: { createdAt: { gte: today.from, lt: today.to } }, _sum: { discountAmount: true, paidAmount: true } }),
    db.$queryRaw<{ key: string; n: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'), 'YYYY-MM-DD') AS key, COUNT(*)::int AS n
      FROM "Redemption" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1`,
    db.$queryRaw<{ key: string; n: number }[]>`
      SELECT to_char(("reviewedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'), 'YYYY-MM-DD') AS key, COUNT(DISTINCT "studentId")::int AS n
      FROM "Verification" WHERE status = 'APPROVED' AND "reviewedAt" >= ${from} AND "reviewedAt" < ${to} GROUP BY 1`,
    db.$queryRaw<{ slug: string; name: string; n: number }[]>`
      SELECT c.slug, c.name, COUNT(*)::int AS n
      FROM "Redemption" r JOIN "Discount" d ON d.id = r."discountId" JOIN "Category" c ON c.id = d."categoryId"
      WHERE r."createdAt" >= ${from} AND r."createdAt" < ${to} GROUP BY c.id, c.slug, c.name`,
    db.$queryRaw<{ shortName: string; n: number }[]>`
      SELECT u."shortName", COUNT(*)::int AS n
      FROM "StudentProfile" p JOIN "University" u ON u.id = p."universityId" JOIN "User" x ON x.id = p."userId"
      WHERE p.status = 'APPROVED' AND x.status = 'ACTIVE'
      GROUP BY u.id, u."shortName" ORDER BY n DESC, u."shortName" LIMIT ${UNIVERSITIES_SHOWN}`,
    pendingCounts(),
    blockedCounts(),
  ]);

  const salesByDay = new Map(series.map((r) => [r.key, r.n]));
  const studentsByDay = new Map(newStudents.map((r) => [r.key, r.n]));
  const daily: DaySeries = days.map((d) => {
    const key = d.toISOString().slice(0, 10);
    return { key, sales: salesByDay.get(key) ?? 0, students: studentsByDay.get(key) ?? 0 };
  });

  return {
    kpi: {
      students,
      newToday,
      businesses,
      activeDiscounts,
      salesToday,
      salesLastWeek,
      saved: sumToday._sum.discountAmount ?? 0,
      revenue: sumToday._sum.paidAmount ?? 0,
    },
    daily,
    categories: categories.map((c) => ({ key: c.slug, name: c.name, count: c.n })),
    universities: universities.map((u) => ({ name: u.shortName, students: u.n })),
    queue,
    blocked,
  };
}

/** Bizneslar reytingi: oxirgi 30 kun sotuvi bo'yicha (sotuvi yo'q ham ko'rinadi — eng oxirida). */
export async function businessRating(now = new Date(), limit = RATING_SHOWN) {
  const days = lastDays(OVERVIEW_DAYS, now);
  const from = dayBounds(days[0]!).from;
  const to = dayBounds(days[days.length - 1]!).to;
  return db.$queryRaw<
    { id: string; name: string; area: string | null; category: string | null; offers: number; sold: number; saved: number; status: "APPROVED" | "WARNED" }[]
  >`
    SELECT b.id, b.name, COALESCE(d.name, b.landmark) AS area, c.name AS category, b.status::text AS status,
           (SELECT COUNT(*) FROM "Discount" x WHERE x."businessId" = b.id AND x.status = 'ACTIVE')::int AS offers,
           COALESCE(s.sold, 0)::int AS sold, COALESCE(s.saved, 0)::int AS saved
    FROM "Business" b
    LEFT JOIN "District" d ON d.id = b."districtId"
    LEFT JOIN LATERAL (
      SELECT cat.name FROM "Discount" x JOIN "Category" cat ON cat.id = x."categoryId" WHERE x."businessId" = b.id ORDER BY x."createdAt" LIMIT 1
    ) c ON TRUE
    LEFT JOIN (
      SELECT "businessId", COUNT(*) AS sold, SUM("discountAmount") AS saved FROM "Redemption"
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY "businessId"
    ) s ON s."businessId" = b.id
    WHERE b.status IN ('APPROVED', 'WARNED')
    ORDER BY sold DESC, b.name
    LIMIT ${limit}`;
}

export async function blockedCounts() {
  const [students, businesses] = await Promise.all([
    db.user.count({ where: { status: "BLOCKED", role: "STUDENT" } }),
    db.business.count({ where: { status: "BLOCKED" } }),
  ]);
  return { students, businesses, total: students + businesses };
}
