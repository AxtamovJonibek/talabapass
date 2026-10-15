import "server-only";
import { periodRange, type Period } from "@/lib/stats";
import type { PaymentType } from "@/generated/prisma/client";
import { db } from "../db";

export const SALES_PAGE_SIZE = 25;
/** Excel faylidagi sotuvlarning yuqori chegarasi (xotira uchun) */
export const EXPORT_MAX_ROWS = 50_000;

const short = (first?: string | null, last?: string | null) => [first, last ? `${last.charAt(0)}.` : null].filter(Boolean).join(" ");

const SELECT = {
  id: true,
  createdAt: true,
  receiptNo: true,
  originalPrice: true,
  discountAmount: true,
  paidAmount: true,
  paymentType: true,
  student: { select: { firstName: true, lastName: true, student: { select: { university: { select: { shortName: true } } } } } },
  cashier: { select: { firstName: true, lastName: true } },
  coupon: { select: { termsTitle: true } },
} as const;

export type SaleRow = {
  id: string;
  at: Date;
  receiptNo: number;
  student: string;
  university: string;
  item: string;
  cashier: string;
  originalPrice: number;
  discountAmount: number;
  paid: number;
  payment: PaymentType;
};

type Raw = Awaited<ReturnType<typeof fetchRows>>[number];
const fetchRows = (businessId: string, from: Date, to: Date, skip: number, take: number) =>
  db.redemption.findMany({
    where: { businessId, createdAt: { gte: from, lt: to } },
    orderBy: [{ createdAt: "desc" }, { receiptNo: "desc" }],
    skip,
    take,
    select: SELECT,
  });

const toRow = (r: Raw): SaleRow => ({
  id: r.id,
  at: r.createdAt,
  receiptNo: r.receiptNo,
  student: short(r.student.firstName, r.student.lastName),
  university: r.student.student?.university.shortName ?? "",
  item: r.coupon.termsTitle,
  cashier: short(r.cashier.firstName, r.cashier.lastName),
  originalPrice: r.originalPrice,
  discountAmount: r.discountAmount,
  paid: r.paidAmount,
  payment: r.paymentType,
});

/** "Sotuvlar va cheklar": davr bo'yicha sahifalangan ro'yxat va jami. */
export async function businessSales(businessId: string, period: Period, page: number, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const total = await db.redemption.aggregate({ where: { businessId, createdAt: { gte: from, lt: to } }, _count: { _all: true }, _sum: { paidAmount: true } });
  const count = total._count._all;
  const pages = Math.max(1, Math.ceil(count / SALES_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const rows = (await fetchRows(businessId, from, to, (current - 1) * SALES_PAGE_SIZE, SALES_PAGE_SIZE)).map(toRow);
  return { rows, count, sum: total._sum.paidAmount ?? 0, page: current, pages };
}

/** Excel uchun: davrdagi barcha sotuvlar (eskisi tepada). */
export async function exportSales(businessId: string, period: Period, now = new Date()): Promise<SaleRow[]> {
  const { from, to } = periodRange(period, now);
  return (await fetchRows(businessId, from, to, 0, EXPORT_MAX_ROWS)).map(toRow);
}
