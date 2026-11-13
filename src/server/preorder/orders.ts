import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "@/lib/format";
import { paymentProvider } from "@/lib/payments";
import {
  canTransition,
  completedSettlement,
  CONFIRM_TIMEOUT_MS,
  findSlot,
  NOTE_MAX,
  noShowSettlement,
  orderAmounts,
  PAYMENT_TIMEOUT_MS,
  QUANTITY_MAX,
  RELEASES_SEAT,
  settlement,
  slotInDiscount,
  type OrderActor,
  type OrderStatus,
} from "@/lib/preorder";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "../audit";
import { encryptSecret } from "../coupons/coupons";
import { db } from "../db";
import { notifyOrder } from "./notify";
import { applyCallback, settlePayment, startPayment } from "./payments";
import { bookableDiscount, bookingConfig } from "./settings";

/**
 * Buyurtma hayoti. Holat faqat `transitionOrder` orqali o'zgaradi: `ORDER_TRANSITIONS` (src/lib/preorder) bo'yicha
 * ruxsat, shartli UPDATE (joriy holatdan), vaqt chizig'i (`OrderEvent`) va audit — bitta tranzaksiyada; slot joyi
 * bo'shashi ham shu yerda. Pul harakati va xabarnoma — tranzaksiyadan keyin.
 * Slot sig'imi: `INSERT … ON CONFLICT DO UPDATE SET booked = booked + 1 WHERE booked < sig'im` — bitta atom so'rov,
 * oxirgi joyni ikki kishi bir vaqtda ololmaydi.
 */

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SECRET_BYTES = 20;
/** Bir talabaning bir vaqtdagi ochiq buyurtmalari */
export const ACTIVE_ORDERS_MAX = 3;
/** Slot tugagach shuncha kutiladi, keyin "Kelmadi" */
export const NO_SHOW_GRACE_MS = 15 * 60_000;
export const OPEN_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "READY"];

export function newOrderCode(): string {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `TB-${part()}-${part()}`;
}

// ───────── holat o'tishi — yagona joy ─────────

const ORDER_MONEY_SELECT = {
  id: true,
  status: true,
  businessId: true,
  studentId: true,
  slotStart: true,
  prepayAmount: true,
  freeCancelMinutes: true,
  keepPercent: true,
  autoConfirm: true,
} satisfies Prisma.OrderSelect;

export type TransitionArgs = {
  orderId: string;
  to: OrderStatus;
  actor: OrderActor;
  actorId: string | null;
  reason?: string | null;
  /** Egalik: talaba faqat o'z buyurtmasini, biznes faqat o'zinikini */
  scope?: { studentId?: string; businessId?: string };
  data?: Prisma.OrderUpdateManyMutationInput;
  now?: Date;
};

export type TransitionResult = { ok: true; from: OrderStatus } | { ok: false; error: "notFound" | "forbidden" | "conflict" };

export async function transitionOrder(args: TransitionArgs): Promise<TransitionResult> {
  const { orderId, to, actor, actorId, reason = null, scope = {}, data = {} } = args;
  const now = args.now ?? new Date();
  const order = await db.order.findFirst({ where: { id: orderId, ...scope }, select: ORDER_MONEY_SELECT });
  if (!order) return { ok: false, error: "notFound" };
  if (!canTransition(actor, order.status, to)) return { ok: false, error: "forbidden" };

  const changed = await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { ...data, status: to, ...(to === "REJECTED" && reason ? { rejectReason: reason } : {}) },
    });
    if (updated.count === 0) return false;
    await tx.orderEvent.create({ data: { orderId: order.id, from: order.status, to, actorId, reason } });
    await tx.auditLog.create({ data: { actorId, action: "order.transition", entity: "Order", entityId: order.id, meta: { from: order.status, to, by: actor, reason } } });
    if (RELEASES_SEAT.includes(to)) {
      await tx.$executeRaw`UPDATE "PreorderSlot" SET booked = booked - 1 WHERE "businessId" = ${order.businessId} AND "startsAt" = ${order.slotStart} AND booked > 0`;
    }
    return true;
  });
  if (!changed) return { ok: false, error: "conflict" };

  const money =
    to === "COMPLETED" ? completedSettlement(order) : to === "NO_SHOW" ? noShowSettlement(order) : to === "CANCELLED" || to === "REJECTED" ? settlement(order, actor, now) : null;
  if (money) await settlePayment(order.id, money).catch((error) => console.error("[orders] pul harakati bajarilmadi:", order.id, to, error));
  await notifyOrder(order.id, order.status, to, actor, actorId);
  return { ok: true, from: order.status };
}

/** To'lov ushlandi (yoki to'lovsiz bron): TO'LANDI, keyin avtomatik tasdiqlash yoki 10 daqiqalik javob muddati. */
export async function markPaid(orderId: string, now = new Date()): Promise<boolean> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { autoConfirm: true } });
  if (!order) return false;
  const paid = await transitionOrder({
    orderId,
    to: "PAID",
    actor: "system",
    actorId: null,
    now,
    data: order.autoConfirm ? {} : { confirmBy: new Date(now.getTime() + CONFIRM_TIMEOUT_MS) },
  });
  if (!paid.ok) return false;
  if (order.autoConfirm) await transitionOrder({ orderId, to: "CONFIRMED", actor: "system", actorId: null, reason: "auto", now });
  return true;
}

// ───────── yaratish ─────────

export const createOrderInput = z.object({
  discountId: z.string().regex(/^[a-z0-9_]{10,40}$/),
  mode: z.enum(["PICKUP", "DINE_IN"]),
  slotStart: z.iso.datetime(),
  quantity: z.number().int().min(1).max(QUANTITY_MAX),
  note: z.string().trim().max(NOTE_MAX).optional(),
  phone: z.string().max(24),
});

export type CreateOrderError = "invalid" | "notAvailable" | "mode" | "slot" | "slotFull" | "phone" | "tooMany" | "paymentUnavailable";
export type CreateOrderResult = { ok: true; orderId: string; checkoutUrl: string | null } | { ok: false; error: CreateOrderError };

export async function createOrder(studentId: string, raw: unknown, now = new Date()): Promise<CreateOrderResult> {
  const parsed = createOrderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "phone" };

  const found = await bookableDiscount(input.discountId, now);
  if (!found) return { ok: false, error: "notAvailable" };
  const { discount, settings, unit } = found;
  if (settings.mode !== "BOTH" && settings.mode !== input.mode) return { ok: false, error: "mode" };
  const slot = findSlot(bookingConfig(settings), new Date(input.slotStart), now);
  if (!slot || !slotInDiscount(discount, slot)) return { ok: false, error: "slot" };
  if (settings.prepay !== "NONE" && !paymentProvider()) return { ok: false, error: "paymentUnavailable" };
  if ((await db.order.count({ where: { studentId, status: { in: OPEN_STATUSES } } })) >= ACTIVE_ORDERS_MAX) return { ok: false, error: "tooMany" };

  const amounts = orderAmounts(unit, input.quantity, { type: settings.prepay, percent: settings.prepayPercent });
  const order = await db.$transaction(async (tx) => {
    const seat = await tx.$queryRaw<{ booked: number }[]>`
      INSERT INTO "PreorderSlot" ("businessId", "startsAt", "booked") VALUES (${discount.businessId}, ${slot.start}, 1)
      ON CONFLICT ("businessId", "startsAt") DO UPDATE SET booked = "PreorderSlot".booked + 1
      WHERE "PreorderSlot".booked < ${settings.slotCapacity}
      RETURNING booked`;
    if (seat.length === 0) return null;
    const created = await tx.order.create({
      data: {
        code: newOrderCode(),
        businessId: discount.businessId,
        discountId: discount.id,
        studentId,
        mode: input.mode,
        slotStart: slot.start,
        slotEnd: slot.end,
        quantity: input.quantity,
        note: input.note || null,
        phone,
        secret: encryptSecret(randomBytes(SECRET_BYTES)),
        title: discount.title,
        unitOriginal: unit.original,
        unitFinal: unit.final,
        totalOriginal: amounts.totalOriginal,
        totalFinal: amounts.totalFinal,
        prepay: settings.prepay,
        prepayAmount: amounts.prepayAmount,
        freeCancelMinutes: settings.freeCancelMinutes,
        keepPercent: settings.keepPercent,
        autoConfirm: settings.autoConfirm,
      },
      select: { id: true, title: true, prepayAmount: true },
    });
    await tx.orderEvent.create({ data: { orderId: created.id, from: null, to: "PENDING_PAYMENT", actorId: studentId } });
    await audit(
      { actorId: studentId, action: "order.create", entity: "Order", entityId: created.id, meta: { discountId: discount.id, slot: slot.start.toISOString(), quantity: input.quantity, ...amounts } },
      tx,
    );
    return created;
  });
  if (!order) return { ok: false, error: "slotFull" };

  if (order.prepayAmount === 0) {
    await markPaid(order.id, now);
    return { ok: true, orderId: order.id, checkoutUrl: null };
  }
  const payment = await startPayment(order);
  return { ok: true, orderId: order.id, checkoutUrl: payment?.checkoutUrl ?? null };
}

/** "To'lash" (buyurtma sahifasidan qayta): o'sha to'lovning sahifasi. */
export async function resumePayment(studentId: string, orderId: string): Promise<string | null> {
  const order = await db.order.findFirst({ where: { id: orderId, studentId, status: "PENDING_PAYMENT" }, select: { id: true, title: true, prepayAmount: true } });
  if (!order || order.prepayAmount === 0) return null;
  return (await startPayment(order))?.checkoutUrl ?? null;
}

// ───────── avtomatika (cron va lazy) ─────────

export type AutomationResult = { unpaid: number; unanswered: number; autoConfirmed: number; noShow: number };

/**
 * To'lanmagan (15 daq) — bekor; qo'lda tasdiqlanmagan (10 daq) — bekor, pul to'liq qaytadi; slot tugab, talaba
 * kelmagan — "Kelmadi" (qoidaga ko'ra yechiladi/qaytadi). Idempotent: har biri shartli o'tish.
 */
export async function runOrderAutomation(now = new Date(), where: Prisma.OrderWhereInput = {}, limit = 200): Promise<AutomationResult> {
  const result: AutomationResult = { unpaid: 0, unanswered: 0, autoConfirmed: 0, noShow: 0 };
  const run = async (filter: Prisma.OrderWhereInput, to: OrderStatus, reason: string, key: keyof AutomationResult) => {
    const due = await db.order.findMany({ where: { AND: [where, filter] }, select: { id: true }, take: limit, orderBy: { createdAt: "asc" } });
    for (const { id } of due) {
      if ((await transitionOrder({ orderId: id, to, actor: "system", actorId: null, reason, now })).ok) result[key]++;
    }
  };
  await run({ status: "PENDING_PAYMENT", createdAt: { lt: new Date(now.getTime() - PAYMENT_TIMEOUT_MS) } }, "CANCELLED", "unpaid", "unpaid");
  await run({ status: "PAID", autoConfirm: false, confirmBy: { lt: now } }, "CANCELLED", "noResponse", "unanswered");
  await run({ status: "PAID", autoConfirm: true }, "CONFIRMED", "auto", "autoConfirmed");
  await run({ status: { in: ["CONFIRMED", "READY"] }, slotEnd: { lt: new Date(now.getTime() - NO_SHOW_GRACE_MS) } }, "NO_SHOW", "noShow", "noShow");
  return result;
}

// ───────── to'lov callback'i ─────────

/** Provayder callback'i → to'lov holati → buyurtma: ushlandi — TO'LANDI, rad etildi — BEKOR. Takroriy callback — hech narsa. */
export async function handlePaymentCallback(providerName: string, body: string, headers: Headers): Promise<{ ok: boolean; orderId?: string }> {
  const outcome = await applyCallback(providerName, body, headers);
  if (!outcome.ok) return { ok: false };
  if (outcome.changed && outcome.event === "HELD") await markPaid(outcome.orderId);
  if (outcome.changed && outcome.event === "FAILED") {
    await transitionOrder({ orderId: outcome.orderId, to: "CANCELLED", actor: "system", actorId: null, reason: "paymentFailed" });
  }
  return { ok: true, orderId: outcome.orderId };
}
