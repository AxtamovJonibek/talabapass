import "server-only";
import { formatMinute, toTashkent } from "@/lib/time";
import { normalizeCouponCode, parseQr, verifyCode, verifyQr } from "@/lib/totp";
import { ORDER_CODE_RE } from "@/lib/preorder";
import type { ScanResult } from "@/generated/prisma/client";
import { decryptSecret } from "../coupons/coupons";
import { checkTicket, signTicket, type Scanner } from "../coupons/scan";
import { db } from "../db";
import { transitionOrder } from "./orders";

/**
 * Kassir skanerida oldindan band qilingan buyurtma (QR `TB-…`): imzo/oyna yoki kod + 6 raqam, biznes — sessiyadan.
 * Faqat tasdiqlangan yoki tayyor buyurtma beriladi; "Berildi" — BERILDI holati va oldindan to'lov yechiladi.
 * Har urinish `ScanAttempt` ga (kuponsiz).
 */

export type OrderScanPreview = {
  orderId: string;
  code: string;
  ticket: string;
  title: string;
  quantity: number;
  mode: "PICKUP" | "DINE_IN";
  /** "14:00–14:30" */
  slot: string;
  student: { name: string; initials: string; phone: string };
  note: string | null;
  prepayAmount: number;
  totalFinal: number;
  /** Kassada qo'shimcha olinadi (qisman yoki to'lovsiz bronda) */
  dueNow: number;
};

export type OrderScanError = Exclude<ScanResult, "OK"> | "ORDER_NOT_CONFIRMED" | "ORDER_CLOSED";
export type OrderScanOutcome = { ok: true; order: OrderScanPreview } | { ok: false; result: OrderScanError };

export const isOrderCode = (code: string) => ORDER_CODE_RE.test(code);

/** QR yoki qo'lda kiritilgan matndan buyurtma kodi (kupon bo'lsa null). */
export function orderCodeOf(input: { qr: string } | { code: string; totp: string }): string | null {
  const code = "qr" in input ? parseQr(input.qr)?.code : normalizeCouponCode(input.code);
  return code && isOrderCode(code) ? code : null;
}

export async function scanOrder(scanner: Scanner, input: { qr: string } | { code: string; totp: string }, nowMs = Date.now()): Promise<OrderScanOutcome> {
  const manual = "code" in input;
  const code = orderCodeOf(input)!;
  const record = (result: ScanResult) => db.scanAttempt.create({ data: { businessId: scanner.businessId, cashierId: scanner.userId, result, manual } });
  const fail = async (result: OrderScanError, recorded: ScanResult = result in { ORDER_NOT_CONFIRMED: 1, ORDER_CLOSED: 1 } ? "INVALID" : (result as ScanResult)) => {
    await record(recorded);
    return { ok: false as const, result };
  };

  const order = await db.order.findUnique({
    where: { code },
    select: {
      id: true, code: true, businessId: true, status: true, secret: true, title: true, quantity: true, mode: true, slotStart: true, slotEnd: true,
      note: true, phone: true, prepayAmount: true, totalFinal: true, student: { select: { firstName: true, lastName: true } },
    },
  });
  if (!order) return fail("INVALID");
  if (order.businessId !== scanner.businessId) return fail("WRONG_BUSINESS");

  const secret = decryptSecret(order.secret);
  if (manual) {
    if (!(await verifyCode(input.totp.trim(), secret, nowMs))) return fail("INVALID");
  } else {
    const check = await verifyQr(parseQr(input.qr)!, secret, nowMs);
    if (check === "invalid") return fail("INVALID");
    if (check === "stale") return fail("EXPIRED");
  }

  if (order.status === "COMPLETED") return fail("REPLAYED");
  if (order.status === "PAID" || order.status === "PENDING_PAYMENT") return fail("ORDER_NOT_CONFIRMED");
  if (order.status !== "CONFIRMED" && order.status !== "READY") return fail("ORDER_CLOSED");

  await record("OK");
  const first = order.student.firstName ?? "";
  const last = order.student.lastName ?? "";
  const minute = (d: Date) => formatMinute(toTashkent(d).minute);
  return {
    ok: true,
    order: {
      orderId: order.id,
      code: order.code,
      ticket: signTicket(order.id, scanner, nowMs),
      title: order.title,
      quantity: order.quantity,
      mode: order.mode,
      slot: `${minute(order.slotStart)}–${minute(order.slotEnd)}`,
      student: { name: [first, last].filter(Boolean).join(" "), initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase(), phone: order.phone },
      note: order.note,
      prepayAmount: order.prepayAmount,
      totalFinal: order.totalFinal,
      dueNow: order.totalFinal - order.prepayAmount,
    },
  };
}

export type CompleteResult = { ok: true } | { ok: false; error: "ticket" | "forbidden" | "notFound" | "conflict" };

/** "Berildi": imzolangan ticket (skan va bosish orasida QR almashsa ham) + ruxsat etilgan o'tish. */
export async function completeOrderScan(scanner: Scanner, orderId: string, ticket: string, now = Date.now()): Promise<CompleteResult> {
  if (!checkTicket(ticket, orderId, scanner, now)) return { ok: false, error: "ticket" };
  const result = await transitionOrder({ orderId, to: "COMPLETED", actor: "cashier", actorId: scanner.userId, scope: { businessId: scanner.businessId } });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
