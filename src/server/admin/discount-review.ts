import "server-only";
import { fromTashkent, toTashkent } from "@/lib/time";
import { audit } from "../audit";
import { db } from "../db";

/**
 * Admin: chegirmalar navbati (har bir yangi yoki mazmuni o'zgargan chegirma). Chaqiruvchi `requireRole("ADMIN")`
 * qilgan deb hisoblanadi — `actorId` audit uchun.
 */

const QUEUE_PAGE = 30;
const QUEUE = { status: "PENDING_REVIEW" } as const;

export const pendingDiscounts = () => db.discount.count({ where: QUEUE });

export async function discountQueue() {
  const [items, total] = await Promise.all([
    db.discount.findMany({
      where: QUEUE,
      orderBy: { updatedAt: "asc" },
      take: QUEUE_PAGE,
      select: {
        id: true,
        title: true,
        type: true,
        percent: true,
        originalPrice: true,
        newPrice: true,
        updatedAt: true,
        reviewedAt: true,
        business: { select: { name: true, status: true } },
      },
    }),
    db.discount.count({ where: QUEUE }),
  ]);
  const startOfToday = fromTashkent(toTashkent(new Date()).date, 0);
  const approvedToday = await db.discount.count({ where: { status: "ACTIVE", reviewedAt: { gte: startOfToday } } });
  return { items, total, approvedToday };
}

export function discountDetail(discountId: string) {
  return db.discount.findUnique({
    where: { id: discountId },
    select: {
      id: true,
      title: true,
      type: true,
      originalPrice: true,
      percent: true,
      newPrice: true,
      note: true,
      weekdays: true,
      fromMinute: true,
      toMinute: true,
      dailyLimit: true,
      perStudentLimit: true,
      startsOn: true,
      endsOn: true,
      terms: true,
      status: true,
      updatedAt: true,
      reviewedAt: true,
      category: { select: { icon: true, tileColor: true, inkColor: true } },
      business: { select: { name: true, status: true, address: true } },
      images: { select: { id: true }, orderBy: { sort: "asc" } },
    },
  });
}

type Decision = { ok: true } | { ok: false; error: "not_pending" };

export async function approveDiscount(discountId: string, actorId: string): Promise<Decision> {
  return db.$transaction(async (tx) => {
    const closed = await tx.discount.updateMany({
      where: { id: discountId, ...QUEUE },
      data: { status: "ACTIVE", rejectReason: null, reviewedById: actorId, reviewedAt: new Date() },
    });
    if (closed.count === 0) return { ok: false as const, error: "not_pending" as const };
    await audit({ actorId, action: "discount.approve", entity: "Discount", entityId: discountId }, tx);
    return { ok: true as const };
  });
}

export async function rejectDiscount(input: { discountId: string; reasonKey: string; reasonText: string }, actorId: string): Promise<Decision> {
  return db.$transaction(async (tx) => {
    const closed = await tx.discount.updateMany({
      where: { id: input.discountId, ...QUEUE },
      data: { status: "REJECTED", rejectReason: input.reasonText, reviewedById: actorId, reviewedAt: new Date() },
    });
    if (closed.count === 0) return { ok: false as const, error: "not_pending" as const };
    await audit({ actorId, action: "discount.reject", entity: "Discount", entityId: input.discountId, meta: { reason: input.reasonKey } }, tx);
    return { ok: true as const };
  });
}
