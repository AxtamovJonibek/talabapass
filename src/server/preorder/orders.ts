import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "@/lib/format";
import { paymentProvider } from "@/lib/payments";
import {
  canTransition,
  capacityUnits,
  completedSettlement,
  CONFIRM_TIMEOUT_MS,
  EXPIRY_REMINDER_DAYS,
  expiredSettlement,
  findSlot,
  NO_SHOW_GRACE_MS,
  NOTE_MAX,
  noShowSettlement,
  orderAmounts,
  PAYMENT_TIMEOUT_MS,
  pickupWindows,
  prepaidExpiry,
  prepayFor,
  QUANTITY_MAX,
  releasesCapacity,
  settlement,
  slotInDiscount,
  type BookingKind,
  type OrderActor,
  type OrderStatus,
} from "@/lib/preorder";
import { toTashkent } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "../audit";
import { encryptSecret } from "../coupons/coupons";
import { db } from "../db";
import { notifyOrder, notifyOrderReminder } from "./notify";
import { applyCallback, captureIfLongLived, settlePayment, startPayment } from "./payments";
import { bookableDiscount, bookingConfig, studentUnits } from "./settings";

export { NO_SHOW_GRACE_MS };

/**
 * Buyurtma hayoti. Holat faqat `transitionOrder` orqali o'zgaradi: `ORDER_TRANSITIONS` (src/lib/preorder) bo'yicha
 * ruxsat (rejimga xos holatlar ham), shartli UPDATE (joriy holatdan), vaqt chizig'i (`OrderEvent`) va audit — bitta
 * tranzaksiyada; sig'im/zaxira qaytishi ham shu yerda. Pul harakati va xabarnoma — tranzaksiyadan keyin.
 * Sig'im atom, bitta so'rov: slot/oyna — `INSERT … ON CONFLICT DO UPDATE SET booked = booked + n WHERE booked + n <= sig'im`,
 * zaxira — `UPDATE "Discount" SET stock = stock - n WHERE stock >= n`. Oxirgi joyni ikki kishi bir vaqtda ololmaydi.
 */

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SECRET_BYTES = 20;
/** Bir talabaning bir vaqtdagi ochiq buyurtmalari */
export const ACTIVE_ORDERS_MAX = 3;
export const OPEN_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "READY"];

export function newOrderCode(): string {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `TB-${part()}-${part()}`;
}

// ───────── holat o'tishi — yagona joy ─────────

const ORDER_MONEY_SELECT = {
  id: true,
  status: true,
  kind: true,
  quantity: true,
  discountId: true,
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
  if (!canTransition(actor, order.status, to, order.kind as BookingKind)) return { ok: false, error: "forbidden" };
  const kind = order.kind as BookingKind;

  const changed = await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { ...data, status: to, ...(to === "REJECTED" && reason ? { rejectReason: reason } : {}) },
    });
    if (updated.count === 0) return false;
    await tx.orderEvent.create({ data: { orderId: order.id, from: order.status, to, actorId, reason } });
    await tx.auditLog.create({ data: { actorId, action: "order.transition", entity: "Order", entityId: order.id, meta: { from: order.status, to, by: actor, reason } } });
    if (releasesCapacity(kind, to)) {
      const units = capacityUnits(kind, order.quantity);
      if (kind === "PREPAID_PICKUP") await tx.$executeRaw`UPDATE "Discount" SET stock = stock + ${units} WHERE id = ${order.discountId}`;
      else await tx.$executeRaw`UPDATE "BookingSeat" SET booked = booked - ${units} WHERE "discountId" = ${order.discountId} AND "startsAt" = ${order.slotStart} AND booked >= ${units}`;
    }
    return true;
  });
  if (!changed) return { ok: false, error: "conflict" };

  const money =
    to === "COMPLETED"
      ? completedSettlement(order)
      : to === "NO_SHOW"
        ? noShowSettlement(order)
        : to === "EXPIRED"
          ? expiredSettlement(order)
          : to === "CANCELLED" || to === "REJECTED"
            ? settlement(order, actor, now)
            : null;
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

/** Talaba yuboradi: APPOINTMENT — slot boshi, PICKUP_WINDOW — oyna boshi (kun), PREPAID_PICKUP — vaqtsiz. */
export const createOrderInput = z.object({
  discountId: z.string().regex(/^[a-z0-9_]{10,40}$/),
  slotStart: z.iso.datetime().optional(),
  quantity: z.number().int().min(1).max(QUANTITY_MAX),
  note: z.string().trim().max(NOTE_MAX).optional(),
  phone: z.string().max(24),
});

export type CreateOrderError =
  | "invalid"
  | "notAvailable"
  | "slot"
  | "slotFull"
  | "soldOut"
  | "quantity"
  | "limit"
  | "phone"
  | "tooMany"
  | "paymentUnavailable";
export type CreateOrderResult = { ok: true; orderId: string; checkoutUrl: string | null } | { ok: false; error: CreateOrderError };

/** Qaysi vaqt oralig'i va sig'im: slot (uchrashuv), kunlik oyna yoki muddat (to'lab olib ketish). */
type Placement = { start: Date; end: Date; capacity: { seat: number } | { stock: true } };

function placementFor(found: NonNullable<Awaited<ReturnType<typeof bookableDiscount>>>, slotStart: string | undefined, now: Date): Placement | null {
  const { discount, settings, kind } = found;
  if (kind === "PREPAID_PICKUP") {
    if (settings.pausedOn?.getTime() === toTashkent(now).date.getTime()) return null;
    return { start: now, end: prepaidExpiry(now, discount.validDays), capacity: { stock: true } };
  }
  if (!slotStart) return null;
  const start = new Date(slotStart);
  if (kind === "APPOINTMENT") {
    const slot = findSlot(bookingConfig(settings, discount.serviceMinutes), start, now);
    return slot && slotInDiscount(discount, slot) ? { start: slot.start, end: slot.end, capacity: { seat: discount.staffCount } } : null;
  }
  const window = pickupWindows(bookingConfig(settings, 0), discount, { from: discount.windowFrom, to: discount.windowTo }, now).find((w) => w.start.getTime() === start.getTime());
  return window && !window.late ? { start: window.start, end: window.end, capacity: { seat: discount.windowCapacity } } : null;
}

export async function createOrder(studentId: string, raw: unknown, now = new Date()): Promise<CreateOrderResult> {
  const parsed = createOrderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "phone" };

  const found = await bookableDiscount(input.discountId, now);
  if (!found) return { ok: false, error: "notAvailable" };
  const { discount, settings, unit, kind } = found;
  if (kind === "APPOINTMENT" ? input.quantity !== 1 : input.quantity > discount.perStudentMax) return { ok: false, error: "quantity" };
  const place = placementFor(found, input.slotStart, now);
  if (!place) return { ok: false, error: "slot" };
  const prepay = prepayFor(kind, settings);
  if (prepay.type !== "NONE" && !paymentProvider()) return { ok: false, error: "paymentUnavailable" };
  if ((await db.order.count({ where: { studentId, status: { in: OPEN_STATUSES } } })) >= ACTIVE_ORDERS_MAX) return { ok: false, error: "tooMany" };
  if (kind !== "APPOINTMENT" && (await studentUnits(studentId, discount.id)) + input.quantity > discount.perStudentMax) return { ok: false, error: "limit" };

  const units = capacityUnits(kind, input.quantity);
  const amounts = orderAmounts(unit, input.quantity, prepay);
  const order = await db.$transaction(async (tx) => {
    const taken =
      "stock" in place.capacity
        ? await tx.$queryRaw<{ stock: number }[]>`UPDATE "Discount" SET stock = stock - ${units} WHERE id = ${discount.id} AND stock >= ${units} RETURNING stock`
        : await tx.$queryRaw<{ booked: number }[]>`
            INSERT INTO "BookingSeat" ("discountId", "startsAt", "booked")
            SELECT ${discount.id}, ${place.start}, ${units} WHERE ${units}::int <= ${place.capacity.seat}::int
            ON CONFLICT ("discountId", "startsAt") DO UPDATE SET booked = "BookingSeat".booked + ${units}
            WHERE "BookingSeat".booked + ${units} <= ${place.capacity.seat}
            RETURNING booked`;
    if (taken.length === 0) return null;
    const created = await tx.order.create({
      data: {
        code: newOrderCode(),
        businessId: discount.businessId,
        discountId: discount.id,
        studentId,
        kind,
        slotStart: place.start,
        slotEnd: place.end,
        quantity: input.quantity,
        note: input.note || null,
        phone,
        secret: encryptSecret(randomBytes(SECRET_BYTES)),
        title: discount.title,
        unitOriginal: unit.original,
        unitFinal: unit.final,
        totalOriginal: amounts.totalOriginal,
        totalFinal: amounts.totalFinal,
        prepay: prepay.type,
        prepayAmount: amounts.prepayAmount,
        // To'lab olib ketishda bepul bekor qilish yo'q: bekor qilinsa ham, muddat o'tsa ham chegirmadagi qoida
        freeCancelMinutes: kind === "PREPAID_PICKUP" ? 0 : settings.freeCancelMinutes,
        keepPercent: kind === "PREPAID_PICKUP" ? discount.expireKeepPercent : settings.keepPercent,
        autoConfirm: settings.autoConfirm,
      },
      select: { id: true, title: true, prepayAmount: true },
    });
    await tx.orderEvent.create({ data: { orderId: created.id, from: null, to: "PENDING_PAYMENT", actorId: studentId } });
    await audit(
      {
        actorId: studentId,
        action: "order.create",
        entity: "Order",
        entityId: created.id,
        meta: { discountId: discount.id, kind, start: place.start.toISOString(), end: place.end.toISOString(), quantity: input.quantity, ...amounts },
      },
      tx,
    );
    return created;
    // Bitta slotga bir vaqtda ko'p so'rov — ulanish navbatini kutadi (atomlik so'rovning o'zida)
  }, { maxWait: 10_000 });
  if (!order) return { ok: false, error: kind === "PREPAID_PICKUP" ? "soldOut" : "slotFull" };

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

export type AutomationResult = { unpaid: number; unanswered: number; autoConfirmed: number; noShow: number; expired: number; reminded: number };

/**
 * To'lanmagan (15 daq) — bekor; qo'lda tasdiqlanmagan (10 daq) — bekor, pul to'liq qaytadi; slot/oyna tugab, talaba
 * kelmagan — "Kelmadi"; to'lab olib ketish muddati o'tgan — "Muddati tugadi" (ikkalasi qoidaga ko'ra yechiladi/qaytadi);
 * muddat tugashiga 2 va 1 kun qolganda eslatma. Idempotent: har biri shartli o'tish yoki shartli UPDATE.
 */
export async function runOrderAutomation(now = new Date(), where: Prisma.OrderWhereInput = {}, limit = 200): Promise<AutomationResult> {
  const result: AutomationResult = { unpaid: 0, unanswered: 0, autoConfirmed: 0, noShow: 0, expired: 0, reminded: 0 };
  const run = async (filter: Prisma.OrderWhereInput, to: OrderStatus, reason: string, key: keyof AutomationResult) => {
    const due = await db.order.findMany({ where: { AND: [where, filter] }, select: { id: true }, take: limit, orderBy: { createdAt: "asc" } });
    for (const { id } of due) {
      if ((await transitionOrder({ orderId: id, to, actor: "system", actorId: null, reason, now })).ok) result[key]++;
    }
  };
  await run({ status: "PENDING_PAYMENT", createdAt: { lt: new Date(now.getTime() - PAYMENT_TIMEOUT_MS) } }, "CANCELLED", "unpaid", "unpaid");
  await run({ status: "PAID", autoConfirm: false, confirmBy: { lt: now } }, "CANCELLED", "noResponse", "unanswered");
  await run({ status: "PAID", autoConfirm: true }, "CONFIRMED", "auto", "autoConfirmed");
  await run({ kind: { in: ["APPOINTMENT", "PICKUP_WINDOW"] }, status: { in: ["CONFIRMED", "READY"] }, slotEnd: { lt: new Date(now.getTime() - NO_SHOW_GRACE_MS) } }, "NO_SHOW", "noShow", "noShow");
  await run({ kind: "PREPAID_PICKUP", status: { in: ["CONFIRMED", "READY"] }, slotEnd: { lte: now } }, "EXPIRED", "expired", "expired");
  result.reminded = await remindExpiring(now, where, limit);
  return result;
}

/**
 * To'lab olib ketish: muddat tugashiga 2 va 1 kun qolganda talabaga eslatma (har biri bir marta — `reminders` shartli
 * UPDATE). Shu chegaradan keyin yaratilgan buyurtmaga (masalan 1 kunlik) o'sha eslatma yuborilmaydi.
 */
async function remindExpiring(now: Date, where: Prisma.OrderWhereInput, limit: number): Promise<number> {
  let sent = 0;
  // Avval yaqinrog'i: 1 kun qolganida 2 kunlik eslatma endi kerak emas
  for (const days of [...EXPIRY_REMINDER_DAYS].sort((a, b) => a - b)) {
    const level = EXPIRY_REMINDER_DAYS.indexOf(days) + 1;
    const edge = new Date(now.getTime() + days * 86_400_000);
    const due = await db.order.findMany({
      where: { AND: [where, { kind: "PREPAID_PICKUP", status: { in: ["CONFIRMED", "READY"] }, reminders: { lt: level }, slotEnd: { gt: now, lte: edge } }] },
      select: { id: true, slotEnd: true, createdAt: true },
      take: limit,
    });
    for (const order of due) {
      const reached = order.slotEnd.getTime() - days * 86_400_000;
      if (order.createdAt.getTime() >= reached) {
        await db.order.updateMany({ where: { id: order.id, reminders: { lt: level } }, data: { reminders: level } });
        continue;
      }
      const marked = await db.order.updateMany({ where: { id: order.id, reminders: { lt: level } }, data: { reminders: level } });
      if (marked.count === 1) {
        await notifyOrderReminder(order.id, days);
        sent++;
      }
    }
  }
  return sent;
}

// ───────── to'lov callback'i ─────────

/** Provayder callback'i → to'lov holati → buyurtma: ushlandi — TO'LANDI, rad etildi — BEKOR. Takroriy callback — hech narsa. */
export async function handlePaymentCallback(providerName: string, body: string, headers: Headers): Promise<{ ok: boolean; orderId?: string }> {
  const outcome = await applyCallback(providerName, body, headers);
  if (!outcome.ok) return { ok: false };
  if (outcome.changed && outcome.event === "HELD") {
    // Uzoq yashaydigan buyurtma (to'lab olib ketish) — provayder ushlab tura olmaydi: darhol yechiladi
    const order = await db.order.findUnique({ where: { id: outcome.orderId }, select: { slotEnd: true } });
    if (order) await captureIfLongLived(outcome.orderId, new Date(order.slotEnd.getTime() + NO_SHOW_GRACE_MS));
    await markPaid(outcome.orderId);
  }
  if (outcome.changed && outcome.event === "FAILED") {
    await transitionOrder({ orderId: outcome.orderId, to: "CANCELLED", actor: "system", actorId: null, reason: "paymentFailed" });
  }
  return { ok: true, orderId: outcome.orderId };
}
