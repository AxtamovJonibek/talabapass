"use server";

import { z } from "zod";
import { requireRole } from "../auth/session";
import { requireActiveStudent } from "../auth/student";
import { cancelCoupon, claimCoupon, studentCoupon, type ClaimError, type CouponView } from "../coupons/coupons";
import { confirmRedemption, scanCoupon, scannerFor, type ConfirmResult, type ScanOutcome } from "../coupons/scan";
import { receipt, type ReceiptData } from "../coupons/receipts";
import { db } from "../db";

const id = z.string().regex(/^[a-z0-9_]{10,40}$/);

/** T5 / WT3 "Chegirmani olish": kupon (yoki shu chegirmadagi faol kupon) — QR uchun secret bilan. */
export async function claimCouponAction(discountId: unknown): Promise<{ ok: true; coupon: CouponView } | { ok: false; error: ClaimError }> {
  const user = await requireActiveStudent();
  const parsed = id.safeParse(discountId);
  if (!parsed.success) return { ok: false, error: "notAvailable" };
  const result = await claimCoupon(user.id, parsed.data);
  if (!result.ok) return result;
  const coupon = await studentCoupon(user.id, result.couponId);
  return coupon ? { ok: true, coupon } : { ok: false, error: "notAvailable" };
}

/** T6 / WT3 "Kuponni bekor qilish" — kunlik qoldiq qaytadi. */
export async function cancelCouponAction(couponId: unknown): Promise<{ ok: boolean }> {
  const user = await requireActiveStudent();
  const parsed = id.safeParse(couponId);
  return { ok: parsed.success && (await cancelCoupon(user.id, parsed.data)) };
}

const scanSchema = z.union([
  z.object({ qr: z.string().max(200) }),
  z.object({ code: z.string().max(40), totp: z.string().max(20) }),
]);

export type ScanActionResult = ScanOutcome | { ok: false; result: "NO_BUSINESS" };

/** B3: QR yoki qo'lda kiritilgan kod. Biznes sessiyadan (kassir — faol a'zoligi, egasi — o'z biznesi). */
export async function scanAction(input: unknown): Promise<ScanActionResult> {
  const user = await requireRole("BUSINESS_OWNER", "CASHIER");
  const scanner = await scannerFor(user);
  if (!scanner) return { ok: false, result: "NO_BUSINESS" };
  const parsed = scanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, result: "INVALID" };
  return scanCoupon(scanner, parsed.data);
}

const confirmSchema = z.object({
  couponId: id,
  ticket: z.string().max(200),
  paymentType: z.enum(["CASH", "CARD", "QR"]),
  amount: z.number().int().nullable().optional(),
});

/** B4 "Sotuvni tasdiqlash" → chek. */
export async function confirmSaleAction(input: unknown): Promise<{ ok: true; receipt: ReceiptData } | Exclude<ConfirmResult, { ok: true }> | { ok: false; error: "NO_BUSINESS" }> {
  const user = await requireRole("BUSINESS_OWNER", "CASHIER");
  const scanner = await scannerFor(user);
  if (!scanner) return { ok: false, error: "NO_BUSINESS" };
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "amount" };
  const result = await confirmRedemption(scanner, parsed.data);
  if (!result.ok) return result;
  const found = await receipt(result.redemptionId);
  return found ? { ok: true, receipt: found.data } : { ok: false, error: "INVALID" };
}

/** T6 / WT3: kassir skanerlab tasdiqladimi (ekran internet bo'lsa so'raydi; QR esa internetsiz ishlayveradi). */
export async function couponStateAction(couponId: unknown): Promise<{ status: "ACTIVE" | "REDEEMED" | "CLOSED"; redemptionId?: string }> {
  const user = await requireActiveStudent();
  const parsed = id.safeParse(couponId);
  if (!parsed.success) return { status: "CLOSED" };
  const coupon = await db.coupon.findFirst({ where: { id: parsed.data, studentId: user.id }, select: { status: true, expiresAt: true, redemption: { select: { id: true } } } });
  if (!coupon) return { status: "CLOSED" };
  if (coupon.status === "REDEEMED") return { status: "REDEEMED", redemptionId: coupon.redemption?.id };
  return { status: coupon.status === "ACTIVE" && coupon.expiresAt > new Date() ? "ACTIVE" : "CLOSED" };
}
