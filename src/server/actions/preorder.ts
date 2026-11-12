"use server";

import { z } from "zod";
import { mockProvider } from "@/lib/payments";
import { requireRole } from "../auth/session";
import { requireActiveStudent } from "../auth/student";
import { scannerFor } from "../coupons/scan";
import { db } from "../db";
import { devShortcutsAllowed } from "../env-check";
import { createOrder, handlePaymentCallback, resumePayment, type CreateOrderResult } from "../preorder/orders";
import { completeOrderScan, type CompleteResult } from "../preorder/scan";
import { bookingOffer, savePreorderSettings, setDiscountPreorder, setPreorderPaused, type BookingOffer, type SaveSettingsResult } from "../preorder/settings";
import { cancelOrderByStudent, decideOrder, type BusinessDecision } from "../preorder/views";

const id = z.string().regex(/^[a-z0-9_]{10,40}$/);

// ───────── talaba ─────────

/** Band qilish oynasi ochilganda: kunlar, bo'sh slotlar, narx va qoidalar (har ochilishda yangi). */
export async function bookingOfferAction(discountId: unknown): Promise<BookingOffer | null> {
  await requireActiveStudent();
  const parsed = id.safeParse(discountId);
  return parsed.success ? bookingOffer(parsed.data) : null;
}

export async function createOrderAction(input: unknown): Promise<CreateOrderResult> {
  const user = await requireActiveStudent();
  return createOrder(user.id, input);
}

export async function cancelOrderAction(orderId: unknown): Promise<{ ok: boolean }> {
  const user = await requireActiveStudent();
  const parsed = id.safeParse(orderId);
  return { ok: parsed.success && (await cancelOrderByStudent(user.id, parsed.data)).ok };
}

/** To'lanmagan buyurtmani to'lash (to'lov sahifasiga qayta). */
export async function payOrderAction(orderId: unknown): Promise<{ checkoutUrl: string | null }> {
  const user = await requireActiveStudent();
  const parsed = id.safeParse(orderId);
  return { checkoutUrl: parsed.success ? await resumePayment(user.id, parsed.data) : null };
}

/**
 * SOXTA to'lov sahifasi ("Test to'lov"): faqat ishlab chiqish va sinov serverida. Callback haqiqiy oqimdagidek
 * imzolanadi va `handlePaymentCallback` dan o'tadi.
 */
export async function mockPayAction(paymentId: unknown, outcome: unknown): Promise<{ ok: boolean; orderId?: string }> {
  const user = await requireActiveStudent();
  if (!devShortcutsAllowed()) return { ok: false };
  const parsedId = id.safeParse(paymentId);
  const parsedOutcome = z.enum(["success", "fail"]).safeParse(outcome);
  if (!parsedId.success || !parsedOutcome.success) return { ok: false };
  const payment = await db.payment.findFirst({
    where: { id: parsedId.data, provider: "mock", order: { studentId: user.id } },
    select: { providerPaymentId: true, amount: true },
  });
  if (!payment?.providerPaymentId) return { ok: false };
  const { body, headers } = mockProvider().signedCallback({
    providerPaymentId: payment.providerPaymentId,
    status: parsedOutcome.data === "success" ? "HELD" : "FAILED",
    amount: payment.amount,
  });
  return handlePaymentCallback("mock", body, headers);
}

// ───────── biznes egasi ─────────

export async function savePreorderSettingsAction(input: unknown): Promise<SaveSettingsResult> {
  const user = await requireRole("BUSINESS_OWNER");
  return savePreorderSettings(user.id, input);
}

export async function setPreorderPausedAction(paused: unknown): Promise<{ ok: boolean }> {
  const user = await requireRole("BUSINESS_OWNER");
  return { ok: typeof paused === "boolean" && (await setPreorderPaused(user.id, paused)) };
}

export async function setDiscountPreorderAction(discountId: unknown, on: unknown): Promise<{ ok: boolean }> {
  const user = await requireRole("BUSINESS_OWNER");
  const parsed = id.safeParse(discountId);
  return { ok: parsed.success && typeof on === "boolean" && (await setDiscountPreorder(user.id, parsed.data, on)) };
}

export async function decideOrderAction(orderId: unknown, decision: unknown, reason?: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole("BUSINESS_OWNER");
  const parsedId = id.safeParse(orderId);
  const parsedDecision = z.enum(["accept", "reject", "ready"]).safeParse(decision);
  const parsedReason = z.string().max(150).optional().safeParse(reason ?? undefined);
  if (!parsedId.success || !parsedDecision.success || !parsedReason.success) return { ok: false, error: "invalid" };
  if (parsedDecision.data === "reject" && !parsedReason.data?.trim()) return { ok: false, error: "reason" };
  const result = await decideOrder(user.id, parsedId.data, parsedDecision.data as BusinessDecision, parsedReason.data);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

// ───────── kassir ─────────

/** Skanerdagi "Berildi". Biznes — sessiyadan. */
export async function completeOrderAction(orderId: unknown, ticket: unknown): Promise<CompleteResult | { ok: false; error: "NO_BUSINESS" }> {
  const user = await requireRole("BUSINESS_OWNER", "CASHIER");
  const scanner = await scannerFor(user);
  if (!scanner) return { ok: false, error: "NO_BUSINESS" };
  const parsedId = id.safeParse(orderId);
  const parsedTicket = z.string().max(200).safeParse(ticket);
  if (!parsedId.success || !parsedTicket.success) return { ok: false, error: "ticket" };
  return completeOrderScan(scanner, parsedId.data, parsedTicket.data);
}
