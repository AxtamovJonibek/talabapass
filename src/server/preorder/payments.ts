import "server-only";
import { paymentProvider, providerByName, type CallbackEvent } from "@/lib/payments";
import { captureOnPay, type Settlement } from "@/lib/preorder";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";

/**
 * To'lov yozuvlari (Payment) va provayder bilan ishlash. Provayder chaqiruvi DB tranzaksiyasidan tashqarida:
 * avval buyurtma holati saqlanadi, keyin pul harakati; har so'rov va callback `PaymentLog` ga yoziladi.
 * Callback idempotent: holat faqat kutilgan holatdan shartli UPDATE bilan o'zgaradi.
 */

const log = (paymentId: string, kind: string, payload: unknown) =>
  db.paymentLog.create({ data: { paymentId, kind, payload: (payload ?? null) as Prisma.InputJsonValue } }).catch((e) => console.error("[payments] log", e));

/** Buyurtma uchun to'lov yaratadi (bir marta — `order:<id>` kaliti). Provayder yo'q bo'lsa null. */
export async function startPayment(order: { id: string; prepayAmount: number; title: string }): Promise<{ checkoutUrl: string } | null> {
  const provider = paymentProvider();
  if (!provider) return null;
  const idempotencyKey = `order:${order.id}`;
  const payment = await db.payment.upsert({
    where: { idempotencyKey },
    create: { orderId: order.id, provider: provider.name, amount: order.prepayAmount, idempotencyKey },
    update: {},
  });
  const created = await provider.createPayment({
    paymentId: payment.id,
    amount: payment.amount,
    idempotencyKey,
    description: order.title,
    returnPath: `/buyurtmalar/${order.id}`,
  });
  if (!payment.providerPaymentId) {
    await db.payment.update({ where: { id: payment.id }, data: { providerPaymentId: created.providerPaymentId } });
  }
  await log(payment.id, "create", { amount: payment.amount, providerPaymentId: created.providerPaymentId });
  return { checkoutUrl: created.checkoutUrl };
}

export type CallbackOutcome = { ok: false } | { ok: true; orderId: string; event: CallbackEvent["status"]; changed: boolean };

/**
 * Provayder callback'i: imzo tekshiriladi, xom yozuv saqlanadi, to'lov holati CREATED → HELD | FAILED (bir marta).
 * Buyurtma holatini chaqiruvchi (`orders.ts`) o'zgartiradi — `changed` bo'lsa.
 */
export async function applyCallback(providerName: string, body: string, headers: Headers): Promise<CallbackOutcome> {
  const provider = providerByName(providerName);
  const event = provider ? await provider.verifyCallback(body, headers) : null;
  if (!provider || !event) return { ok: false };
  const payment = await db.payment.findUnique({
    where: { provider_providerPaymentId: { provider: provider.name, providerPaymentId: event.providerPaymentId } },
    select: { id: true, orderId: true, amount: true },
  });
  if (!payment) return { ok: false };
  await log(payment.id, "callback", event);
  if (event.amount !== payment.amount) return { ok: false };
  if (event.status !== "HELD" && event.status !== "FAILED") return { ok: true, orderId: payment.orderId, event: event.status, changed: false };
  const changed = await db.payment.updateMany({ where: { id: payment.id, status: "CREATED" }, data: { status: event.status } });
  return { ok: true, orderId: payment.orderId, event: event.status, changed: changed.count === 1 };
}

/**
 * Pul ushlangandan keyin: buyurtma provayder ushlab tura oladigan muddatdan uzoq yashasa (`holdMaxDays`) — darhol to'liq
 * yechiladi (CAPTURED); keyingi qaytarishlar `settlePayment` → refund. Aks holda hold qoladi.
 */
export async function captureIfLongLived(orderId: string, holdUntil: Date, now = new Date()): Promise<boolean> {
  const payment = await db.payment.findUnique({ where: { orderId } });
  if (!payment || payment.status !== "HELD" || !payment.providerPaymentId) return false;
  const provider = providerByName(payment.provider);
  if (!provider || !captureOnPay(holdUntil, now, provider.holdMaxDays)) return false;
  const result = await provider.capture(payment.providerPaymentId, payment.amount);
  await log(payment.id, "capture-now", { amount: payment.amount, holdUntil: holdUntil.toISOString(), holdMaxDays: provider.holdMaxDays, result });
  if (!result.ok) return false;
  const updated = await db.payment.updateMany({ where: { id: payment.id, status: "HELD" }, data: { status: "CAPTURED", captured: payment.amount } });
  return updated.count === 1;
}

/**
 * Buyurtma yopilganda pul: `keep` biznesga yechiladi (capture), qolgani bo'shatiladi. Hali to'lanmagan bo'lsa —
 * to'lov bekor. Allaqachon yechilgan bo'lsa va qaytarish kerak bo'lsa — refund.
 */
export async function settlePayment(orderId: string, money: Settlement): Promise<void> {
  const payment = await db.payment.findUnique({ where: { orderId } });
  if (!payment) return;
  if (payment.status === "CREATED") {
    await db.payment.updateMany({ where: { id: payment.id, status: "CREATED" }, data: { status: "CANCELLED" } });
    await log(payment.id, "cancel-unpaid", null);
    return;
  }
  const provider = providerByName(payment.provider);
  if (!provider || !payment.providerPaymentId) {
    await log(payment.id, "settle-error", { reason: "no provider", ...money });
    return;
  }
  if (payment.status === "HELD") {
    if (money.keep > 0) {
      const result = await provider.capture(payment.providerPaymentId, money.keep);
      await log(payment.id, "capture", { amount: money.keep, result });
      if (result.ok) await db.payment.updateMany({ where: { id: payment.id, status: "HELD" }, data: { status: "CAPTURED", captured: money.keep } });
    } else {
      const result = await provider.cancelHold(payment.providerPaymentId);
      await log(payment.id, "cancel-hold", { result });
      if (result.ok) await db.payment.updateMany({ where: { id: payment.id, status: "HELD" }, data: { status: "CANCELLED" } });
    }
    return;
  }
  // Darhol yechilgan (uzoq muddatli) to'lov: biznes ulushi joyida qoladi, talabaniki — refund
  if (payment.status === "CAPTURED" && money.refund > 0) await refundPayment(payment.id, Math.min(money.refund, payment.captured - money.keep));
}

/** Yechilgan puldan qaytarish (to'liq yoki qisman). */
export async function refundPayment(paymentId: string, amount: number): Promise<boolean> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment?.providerPaymentId || amount <= 0) return false;
  const left = payment.captured - payment.refunded;
  const value = Math.min(amount, left);
  if (value <= 0) return false;
  const provider = providerByName(payment.provider);
  const result = provider ? await provider.refund(payment.providerPaymentId, value) : { ok: false as const, error: "no provider" };
  await log(payment.id, "refund", { amount: value, result });
  if (!result.ok) return false;
  const refunded = payment.refunded + value;
  await db.payment.update({ where: { id: payment.id }, data: { refunded, status: refunded >= payment.captured ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
  return true;
}
