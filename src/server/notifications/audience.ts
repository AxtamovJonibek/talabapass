import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AudienceKey } from "@/lib/notifications";
import { db } from "../db";

/** Hudud auditoriyasi: talabaning tumani bazada yo'q — oxirgi shuncha kunda shu tumandagi biznesdan kupon olganlar. */
export const DISTRICT_LOOKBACK_DAYS = 90;
const DAY_MS = 86_400_000;

/**
 * Auditoriyaga kiradigan foydalanuvchilar sharti. Faqat faol (bloklanmagan) hisoblar:
 * talaba — guvohnomasi tasdiqlangan; biznes — tasdiqlangan (APPROVED/WARNED) biznes egasi.
 */
export function audienceWhere(audience: AudienceKey, ids: string[], now: Date): Prisma.UserWhereInput {
  const student: Prisma.UserWhereInput = { role: "STUDENT", status: "ACTIVE" };
  switch (audience) {
    case "ALL_STUDENTS":
      return { ...student, student: { is: { status: "APPROVED" } } };
    case "UNIVERSITY":
      return { ...student, student: { is: { status: "APPROVED", universityId: { in: ids } } } };
    case "DISTRICT":
      return {
        ...student,
        student: { is: { status: "APPROVED" } },
        coupons: {
          some: {
            createdAt: { gte: new Date(now.getTime() - DISTRICT_LOOKBACK_DAYS * DAY_MS) },
            discount: { business: { districtId: { in: ids } } },
          },
        },
      };
    case "BUSINESSES":
      return { role: "BUSINESS_OWNER", status: "ACTIVE", ownedBusinesses: { some: { status: { in: ["APPROVED", "WARNED"] }, submittedAt: { not: null } } } };
  }
}

export async function audienceUserIds(audience: AudienceKey, ids: string[], now = new Date()): Promise<string[]> {
  const rows = await db.user.findMany({ where: audienceWhere(audience, ids, now), select: { id: true } });
  return rows.map((r) => r.id);
}

export const audienceReach = (audience: AudienceKey, ids: string[], now = new Date()) => db.user.count({ where: audienceWhere(audience, ids, now) });

/** Formadagi tanlovlar: universitetlar va tumanlar (qamrov bilan) hamda havola uchun kategoriyalar/chegirmalar. */
export async function audienceOptions(now = new Date()) {
  const [universities, districts, categories, discounts, all, businesses] = await Promise.all([
    db.university.findMany({ orderBy: { shortName: "asc" }, select: { id: true, shortName: true } }),
    db.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { sort: "asc" }, select: { slug: true, name: true } }),
    db.discount.findMany({ where: { status: "ACTIVE", business: { status: { in: ["APPROVED", "WARNED"] } } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, business: { select: { name: true } } } }),
    audienceReach("ALL_STUDENTS", [], now),
    audienceReach("BUSINESSES", [], now),
  ]);
  const [uniCounts, districtCounts] = await Promise.all([
    Promise.all(universities.map((u) => audienceReach("UNIVERSITY", [u.id], now))),
    Promise.all(districts.map((d) => audienceReach("DISTRICT", [d.id], now))),
  ]);
  return {
    universities: universities.map((u, i) => ({ id: u.id, label: u.shortName, count: uniCounts[i]! })),
    districts: districts.map((d, i) => ({ id: d.id, label: d.name, count: districtCounts[i]! })),
    categories,
    discounts: discounts.map((d) => ({ id: d.id, label: `${d.business.name} — ${d.title}` })),
    totals: { all, businesses },
  };
}
