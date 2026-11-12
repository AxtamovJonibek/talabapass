import "server-only";
import { ORDER_FILTERS, settlement, freeCancelUntil, type OrderFilter, type OrderStatus } from "@/lib/preorder";
import { toTashkent, fromTashkent } from "@/lib/time";
import { toBase64Url } from "@/lib/totp";
import { decryptSecret } from "../coupons/coupons";
import { db } from "../db";
import { ownerBusinessForDiscounts } from "../business/discounts";
import { OPEN_STATUSES, runOrderAutomation, transitionOrder, type TransitionResult } from "./orders";

const DAY_MS = 86_400_000;

// ───────── talaba ─────────

export type StudentOrderRow = {
  id: string;
  status: OrderStatus;
  title: string;
  businessName: string;
  mode: "PICKUP" | "DINE_IN";
  slotStart: string;
  slotEnd: string;
  quantity: number;
  totalFinal: number;
};

export async function studentOrders(studentId: string, now = new Date()): Promise<StudentOrderRow[]> {
  await runOrderAutomation(now, { studentId });
  const rows = await db.order.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, status: true, title: true, mode: true, slotStart: true, slotEnd: true, quantity: true, totalFinal: true, business: { select: { name: true } } },
  });
  return rows.map((o) => ({ ...o, businessName: o.business.name, slotStart: o.slotStart.toISOString(), slotEnd: o.slotEnd.toISOString() }));
}

export type StudentOrderView = StudentOrderRow & {
  code: string;
  /** QR uchun (faqat tasdiqlangan/tayyor buyurtmada) */
  secret: string | null;
  address: string;
  note: string | null;
  phone: string;
  unitOriginal: number;
  unitFinal: number;
  totalOriginal: number;
  prepay: "FULL" | "PARTIAL" | "NONE";
  prepayAmount: number;
  rejectReason: string | null;
  freeCancelUntil: string;
  keepPercent: number;
  /** Hozir bekor qilinsa: qaytadigan va biznesda qoladigan summa (null — bekor qilib bo'lmaydi) */
  cancel: { refund: number; keep: number } | null;
  events: { to: OrderStatus; at: string; reason: string | null }[];
  /** Server vaqti (ms) — QR birinchi chizilishi */
  renderedAt: number;
};

export async function studentOrder(studentId: string, orderId: string, now = new Date()): Promise<StudentOrderView | null> {
  await runOrderAutomation(now, { id: orderId, studentId });
  const o = await db.order.findFirst({
    where: { id: orderId, studentId },
    include: { business: { select: { name: true, address: true, landmark: true } }, events: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true, reason: true } } },
  });
  if (!o) return null;
  const cancellable = OPEN_STATUSES.includes(o.status);
  return {
    id: o.id,
    status: o.status,
    title: o.title,
    businessName: o.business.name,
    address: [o.business.address, o.business.landmark].filter(Boolean).join(", "),
    mode: o.mode,
    slotStart: o.slotStart.toISOString(),
    slotEnd: o.slotEnd.toISOString(),
    quantity: o.quantity,
    note: o.note,
    phone: o.phone,
    code: o.code,
    secret: o.status === "CONFIRMED" || o.status === "READY" ? toBase64Url(decryptSecret(o.secret)) : null,
    unitOriginal: o.unitOriginal,
    unitFinal: o.unitFinal,
    totalOriginal: o.totalOriginal,
    totalFinal: o.totalFinal,
    prepay: o.prepay,
    prepayAmount: o.prepayAmount,
    rejectReason: o.rejectReason,
    freeCancelUntil: freeCancelUntil(o).toISOString(),
    keepPercent: o.keepPercent,
    cancel: cancellable ? settlement(o, "student", now) : null,
    events: o.events.map((e) => ({ to: e.to, at: e.createdAt.toISOString(), reason: e.reason })),
    renderedAt: now.getTime(),
  };
}

export const cancelOrderByStudent = (studentId: string, orderId: string): Promise<TransitionResult> =>
  transitionOrder({ orderId, to: "CANCELLED", actor: "student", actorId: studentId, reason: "student", scope: { studentId } });

// ───────── biznes ─────────

export type BusinessOrderRow = {
  id: string;
  code: string;
  status: OrderStatus;
  title: string;
  quantity: number;
  mode: "PICKUP" | "DINE_IN";
  slotStart: string;
  slotEnd: string;
  note: string | null;
  phone: string;
  student: string;
  totalFinal: number;
  prepay: "FULL" | "PARTIAL" | "NONE";
  prepayAmount: number;
  confirmBy: string | null;
  rejectReason: string | null;
};

export type DailyReport = { orders: number; completed: number; revenue: number; cancelled: number; noShow: number };

export type BusinessOrders = {
  orders: BusinessOrderRow[];
  counts: Record<OrderFilter, number>;
  /** Javob kutayotgan (to'langan) buyurtmalar — yangisi paydo bo'lsa signal */
  newIds: string[];
  report: DailyReport;
  /** server vaqti, ms */
  now: number;
};

/** Bugungi (Toshkent) slotlar bo'yicha: buyurtmalar (to'lanmagan holda bekor bo'lganlarsiz), tushum, bekor, kelmagan. */
export async function dailyReport(businessId: string, now = new Date()): Promise<DailyReport> {
  const from = fromTashkent(toTashkent(now).date);
  const to = new Date(from.getTime() + DAY_MS);
  const [row] = await db.$queryRaw<{ orders: bigint; completed: bigint; cancelled: bigint; no_show: bigint; revenue: bigint | null }[]>`
    SELECT count(*) AS orders,
           count(*) FILTER (WHERE o.status = 'COMPLETED') AS completed,
           count(*) FILTER (WHERE o.status IN ('CANCELLED', 'REJECTED')) AS cancelled,
           count(*) FILTER (WHERE o.status = 'NO_SHOW') AS no_show,
           sum(COALESCE(p.captured - p.refunded, 0) + CASE WHEN o.status = 'COMPLETED' THEN o."totalFinal" - o."prepayAmount" ELSE 0 END) AS revenue
    FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o.id
    WHERE o."businessId" = ${businessId} AND o."slotStart" >= ${from} AND o."slotStart" < ${to} AND o.status <> 'PENDING_PAYMENT'
      AND NOT EXISTS (SELECT 1 FROM "OrderEvent" e WHERE e."orderId" = o.id AND e."from" = 'PENDING_PAYMENT' AND e."to" = 'CANCELLED')`;
  return {
    orders: Number(row?.orders ?? 0),
    completed: Number(row?.completed ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    noShow: Number(row?.no_show ?? 0),
    revenue: Number(row?.revenue ?? 0),
  };
}

export async function businessOrders(businessId: string, filter: OrderFilter, now = new Date()): Promise<BusinessOrders> {
  await runOrderAutomation(now, { businessId });
  const since = new Date(now.getTime() - DAY_MS);
  const visible = (statuses: readonly OrderStatus[], done: boolean) => ({
    businessId,
    status: { in: [...statuses] },
    ...(done ? { updatedAt: { gte: since } } : {}),
  });
  const [rows, fresh, ...counts] = await Promise.all([
    db.order.findMany({
      where: visible(ORDER_FILTERS[filter], filter === "done"),
      orderBy: filter === "done" ? { updatedAt: "desc" } : { slotStart: "asc" },
      take: 100,
      select: {
        id: true, code: true, status: true, title: true, quantity: true, mode: true, slotStart: true, slotEnd: true, note: true, phone: true,
        totalFinal: true, prepay: true, prepayAmount: true, confirmBy: true, rejectReason: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    db.order.findMany({ where: { businessId, status: "PAID" }, select: { id: true } }),
    ...(Object.keys(ORDER_FILTERS) as OrderFilter[]).map((f) => db.order.count({ where: visible(ORDER_FILTERS[f], f === "done") })),
  ]);
  const keys = Object.keys(ORDER_FILTERS) as OrderFilter[];
  return {
    orders: rows.map(({ student, ...o }) => ({
      ...o,
      slotStart: o.slotStart.toISOString(),
      slotEnd: o.slotEnd.toISOString(),
      confirmBy: o.confirmBy?.toISOString() ?? null,
      student: [student.firstName, student.lastName].filter(Boolean).join(" "),
    })),
    counts: Object.fromEntries(keys.map((k, i) => [k, counts[i] as number])) as Record<OrderFilter, number>,
    newIds: fresh.map((o) => o.id),
    report: await dailyReport(businessId, now),
    now: now.getTime(),
  };
}

/** Egasi uchun biznes (buyurtmalar faqat shu biznesniki) */
export async function ownerOrdersBusiness(ownerId: string) {
  return ownerBusinessForDiscounts(ownerId);
}

export type BusinessDecision = "accept" | "reject" | "ready";

export async function decideOrder(ownerId: string, orderId: string, decision: BusinessDecision, reason?: string): Promise<TransitionResult> {
  const business = await ownerBusinessForDiscounts(ownerId);
  if (!business) return { ok: false, error: "notFound" };
  const to: OrderStatus = decision === "accept" ? "CONFIRMED" : decision === "reject" ? "REJECTED" : "READY";
  return transitionOrder({
    orderId,
    to,
    actor: "business",
    actorId: ownerId,
    reason: decision === "reject" ? reason?.trim().slice(0, 150) || null : null,
    scope: { businessId: business.id },
    data: to === "CONFIRMED" ? { confirmBy: null } : {},
  });
}
