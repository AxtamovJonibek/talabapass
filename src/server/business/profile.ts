import "server-only";
import { fromTashkent, toTashkent } from "@/lib/time";
import { businessLogoUrl } from "@/lib/profile-image";
import { db } from "../db";

/** B5 sarlavhasi: biznes, holati va bugungi ko'rsatkichlar (Toshkent kuni bo'yicha). */
export async function ownerProfile(ownerId: string, now = new Date()) {
  const business = await db.business.findFirst({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
    select: { id: true, logoKey: true, name: true, kind: true, typeLabel: true, workingHours: true, status: true, district: { select: { name: true } } },
  });
  if (!business) return null;
  const today = fromTashkent(toTashkent(now).date, 0);
  const [sales, active] = await Promise.all([
    db.redemption.aggregate({ where: { businessId: business.id, createdAt: { gte: today } }, _count: { _all: true }, _sum: { paidAmount: true } }),
    db.discount.count({ where: { businessId: business.id, status: "ACTIVE" } }),
  ]);
  return { ...business, logoUrl: businessLogoUrl(business.id, business.logoKey), salesToday: sales._count._all, revenueToday: sales._sum.paidAmount ?? 0, activeDiscounts: active };
}
export type OwnerProfile = NonNullable<Awaited<ReturnType<typeof ownerProfile>>>;
