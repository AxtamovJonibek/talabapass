import "server-only";
import type { Prisma, ScanResult } from "@/generated/prisma/client";
import { classifyQuery, TX_EXPORT_LIMIT, TX_PAGE_SIZE, type TxFilter } from "@/lib/admin-transactions";
import { periodStart } from "@/lib/admin-stats";
import { db } from "../db";

/**
 * Admin "Tranzaksiyalar": muvaffaqiyatli xaridlar (`Redemption`) va rad etilgan skanlar (`ScanAttempt`, natija ≠ OK)
 * bitta vaqt tartibidagi ro'yxatda. Chaqiruvchi `requireRole("ADMIN")` qilgan.
 */

/** Rad etish sababi (OK — muvaffaqiyatli skan, bu yerda chiqmaydi) */
export type FailedReason = Exclude<ScanResult, "OK">;

export type TxRow = {
  id: string;
  ok: boolean;
  at: Date;
  receiptNo: number | null;
  student: string;
  university: string;
  course: string | null;
  business: string;
  cashier: string;
  item: string;
  original: number | null;
  discount: number | null;
  paid: number | null;
  reason: FailedReason | null;
};

const shortName = (first?: string | null, last?: string | null) => [first, last ? `${last.charAt(0)}.` : null].filter(Boolean).join(" ");
const fullName = (first?: string | null, last?: string | null) => [first, last].filter(Boolean).join(" ");

/** "Dilnoza Karimova" — har bir so'z ism yoki familiyada (yoki telefonda) uchrashi kerak. */
function studentMatch(q: string): Prisma.UserWhereInput {
  const { digits } = classifyQuery(q);
  const words = q.split(/\s+/).filter(Boolean);
  const byName: Prisma.UserWhereInput = {
    AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: "insensitive" } }, { lastName: { contains: w, mode: "insensitive" } }] })),
  };
  return digits.length >= 3 ? { OR: [byName, { phone: { contains: digits } }] } : byName;
}

function businessMatch(q: string): Prisma.BusinessWhereInput {
  const { tin } = classifyQuery(q);
  return { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(tin ? [{ tin }] : [])] };
}

function redemptionWhere(filter: TxFilter, now: Date): Prisma.RedemptionWhereInput {
  const since = periodStart(filter.period, now);
  const { receipt } = classifyQuery(filter.q);
  return {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filter.q
      ? { OR: [...(receipt != null ? [{ receiptNo: receipt }] : []), { student: studentMatch(filter.q) }, { business: businessMatch(filter.q) }] }
      : {}),
  };
}

function failedWhere(filter: TxFilter, now: Date): Prisma.ScanAttemptWhereInput {
  const since = periodStart(filter.period, now);
  return {
    result: { not: "OK" },
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(filter.q ? { OR: [{ coupon: { student: studentMatch(filter.q) } }, { business: businessMatch(filter.q) }] } : {}),
  };
}

const REDEMPTION_SELECT = {
  id: true,
  createdAt: true,
  receiptNo: true,
  originalPrice: true,
  discountAmount: true,
  paidAmount: true,
  coupon: { select: { termsTitle: true } },
  business: { select: { name: true } },
  cashier: { select: { firstName: true, lastName: true } },
  student: { select: { firstName: true, lastName: true, student: { select: { course: true, university: { select: { shortName: true } } } } } },
} satisfies Prisma.RedemptionSelect;

const FAILED_SELECT = {
  id: true,
  createdAt: true,
  result: true,
  business: { select: { name: true } },
  cashier: { select: { firstName: true, lastName: true } },
  coupon: {
    select: {
      termsTitle: true,
      termsOriginalPrice: true,
      student: { select: { firstName: true, lastName: true, student: { select: { course: true, university: { select: { shortName: true } } } } } },
    },
  },
} satisfies Prisma.ScanAttemptSelect;

type Fetched = { rows: TxRow[]; total: number };

async function fetchRows(filter: TxFilter, now: Date, take: number, skip: number): Promise<Fetched> {
  const wantOk = filter.status !== "no";
  const wantFailed = filter.status !== "ok";
  const okWhere = redemptionWhere(filter, now);
  const noWhere = failedWhere(filter, now);

  const [redemptions, failed, okTotal, noTotal] = await Promise.all([
    wantOk ? db.redemption.findMany({ where: okWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: skip + take, select: REDEMPTION_SELECT }) : [],
    wantFailed ? db.scanAttempt.findMany({ where: noWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: skip + take, select: FAILED_SELECT }) : [],
    wantOk ? db.redemption.count({ where: okWhere }) : 0,
    wantFailed ? db.scanAttempt.count({ where: noWhere }) : 0,
  ]);

  const rows: TxRow[] = [
    ...redemptions.map((r) => ({
      id: `r_${r.id}`,
      ok: true,
      at: r.createdAt,
      receiptNo: r.receiptNo,
      student: fullName(r.student.firstName, r.student.lastName),
      university: r.student.student?.university.shortName ?? "",
      course: r.student.student?.course ?? null,
      business: r.business.name,
      cashier: shortName(r.cashier.firstName, r.cashier.lastName),
      item: r.coupon.termsTitle,
      original: r.originalPrice,
      discount: r.discountAmount,
      paid: r.paidAmount,
      reason: null,
    })),
    ...failed.map((a) => ({
      id: `a_${a.id}`,
      ok: false,
      at: a.createdAt,
      receiptNo: null,
      student: a.coupon ? fullName(a.coupon.student.firstName, a.coupon.student.lastName) : "",
      university: a.coupon?.student.student?.university.shortName ?? "",
      course: a.coupon?.student.student?.course ?? null,
      business: a.business.name,
      cashier: shortName(a.cashier.firstName, a.cashier.lastName),
      item: a.coupon?.termsTitle ?? "",
      original: a.coupon?.termsOriginalPrice ?? null,
      discount: null,
      paid: null,
      reason: a.result as FailedReason,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime() || b.id.localeCompare(a.id));

  return { rows: rows.slice(skip, skip + take), total: okTotal + noTotal };
}

export async function transactionPage(filter: TxFilter, now = new Date()) {
  const { rows, total } = await fetchRows(filter, now, TX_PAGE_SIZE, (filter.page - 1) * TX_PAGE_SIZE);
  return { rows, total, pages: Math.max(1, Math.ceil(total / TX_PAGE_SIZE)) };
}

/** Eksport: filtr bilan bir xil, sahifasiz (TX_EXPORT_LIMIT gacha). */
export async function transactionExport(filter: TxFilter, now = new Date()) {
  const { rows, total } = await fetchRows(filter, now, TX_EXPORT_LIMIT, 0);
  return { rows, truncated: total > rows.length };
}

/** Sarlavhadagi umumiy ko'rsatkichlar (filtrga mos muvaffaqiyatli xaridlar). */
export async function transactionTotals(filter: TxFilter, now = new Date()) {
  const sum = await db.redemption.aggregate({ where: redemptionWhere(filter, now), _sum: { paidAmount: true, discountAmount: true } });
  return { paid: sum._sum.paidAmount ?? 0, discount: sum._sum.discountAmount ?? 0 };
}
