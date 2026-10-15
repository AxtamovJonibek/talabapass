import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { priceAfterPercent } from "@/lib/format";
import { normalizeCouponCode, parseQr, verifyCode, verifyQr, COUPON_CODE_RE } from "@/lib/totp";
import type { PaymentType, Prisma, ScanResult } from "@/generated/prisma/client";
import { db } from "../db";
import { authSecret } from "../env";
import { LIVE_BUSINESS_STATUSES } from "../student/feed";
import { closeCoupon, decryptSecret, snapshotBadge } from "./coupons";

/**
 * Kassir skaneri (B3) va sotuvni tasdiqlash (B4).
 * Skan: kassir faqat o'z biznesini (biznes so'rovdan emas — sessiyadan), QR imzosi va oynasi (±1) yoki
 * kupon kodi + 6 raqamli kod, kupon holati/muddati. Har bir urinish (muvaffaqiyatlisi ham) `ScanAttempt` ga.
 * Tasdiqlash atom: `UPDATE … WHERE status='ACTIVE' AND "expiresAt" > now()` + `Redemption.couponId UNIQUE`.
 */

export const MANUAL_MAX_ATTEMPTS = 5;
const TICKET_TTL_MS = 5 * 60_000;

export type Scanner = { userId: string; businessId: string; businessName: string };

/** Skanerlay oladigan foydalanuvchining biznesi: kassir — faol a'zoligi; egasi — o'z tasdiqlangan biznesi. */
export async function scannerFor(user: { id: string; role: string }): Promise<Scanner | null> {
  const business =
    user.role === "CASHIER"
      ? (await db.businessMember.findFirst({
          where: { userId: user.id, role: "CASHIER", active: true, business: { status: { in: LIVE_BUSINESS_STATUSES } } },
          select: { business: { select: { id: true, name: true } } },
        }))?.business
      : user.role === "BUSINESS_OWNER"
        ? await db.business.findFirst({ where: { ownerId: user.id, status: { in: LIVE_BUSINESS_STATUSES } }, select: { id: true, name: true } })
        : null;
  return business ? { userId: user.id, businessId: business.id, businessName: business.name } : null;
}

export type ScanInput = { qr: string } | { code: string; totp: string };

export type ScanPreview = {
  couponId: string;
  code: string;
  /** Tasdiqlash uchun qisqa muddatli imzo: skan va tasdiqlash orasida QR oynasi almashsa ham */
  ticket: string;
  student: { name: string; initials: string; university: string; course: string };
  title: string;
  badge: string;
  /** Snapshot summalari; narxsiz chegirmada null — kassir chek summasini kiritadi */
  originalPrice: number | null;
  discountAmount: number | null;
  finalPrice: number | null;
  /** Narxsiz foizli chegirma: chek summasidan foiz */
  percent: number | null;
  bogo: boolean;
  limit: "DAILY" | "WEEKLY" | "UNLIMITED";
  /** Talabaning shu chegirmadagi bugungi (yoki shu haftadagi) xaridi — shu bilan nechanchi */
  nth: number;
};

export type ScanOutcome = { ok: true; preview: ScanPreview } | { ok: false; result: Exclude<ScanResult, "OK">; attemptsLeft?: number };

const COUPON_SCAN_SELECT = {
  id: true,
  code: true,
  secret: true,
  status: true,
  expiresAt: true,
  manualAttempts: true,
  studentId: true,
  date: true,
  termsTitle: true,
  termsType: true,
  termsPercent: true,
  termsOriginalPrice: true,
  termsDiscountAmount: true,
  termsFinalPrice: true,
  discount: { select: { id: true, businessId: true, perStudentLimit: true } },
  student: {
    select: {
      status: true,
      firstName: true,
      lastName: true,
      student: { select: { status: true, cardExpiresAt: true, course: true, university: { select: { shortName: true } } } },
    },
  },
} satisfies Prisma.CouponSelect;

async function record(scanner: Scanner, result: ScanResult, couponId: string | null, manual: boolean) {
  await db.scanAttempt.create({ data: { businessId: scanner.businessId, cashierId: scanner.userId, couponId, result, manual } });
}

const ticketMac = (couponId: string, scanner: Scanner, expires: number) =>
  createHmac("sha256", authSecret()).update(`tp-scan:${couponId}:${scanner.businessId}:${scanner.userId}:${expires}`).digest("base64url");

export function signTicket(couponId: string, scanner: Scanner, now = Date.now()): string {
  const expires = now + TICKET_TTL_MS;
  return `${expires}.${ticketMac(couponId, scanner, expires)}`;
}

export function checkTicket(ticket: string, couponId: string, scanner: Scanner, now = Date.now()): boolean {
  const [raw, mac] = ticket.split(".");
  const expires = Number(raw);
  if (!mac || !Number.isSafeInteger(expires) || expires <= now) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(ticketMac(couponId, scanner, expires));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** QR yoki qo'lda kiritilgan kupon tekshiruvi. Sotuv hali yozilmaydi — kassir B4 da tasdiqlaydi. */
export async function scanCoupon(scanner: Scanner, input: ScanInput, nowMs = Date.now()): Promise<ScanOutcome> {
  const manual = "code" in input;
  const parsed = manual ? null : parseQr(input.qr);
  const code = manual ? normalizeCouponCode(input.code) : parsed?.code;

  if (!code || !COUPON_CODE_RE.test(code)) {
    await record(scanner, "INVALID", null, manual);
    return { ok: false, result: "INVALID" };
  }
  const coupon = await db.coupon.findUnique({ where: { code }, select: COUPON_SCAN_SELECT });
  if (!coupon) {
    await record(scanner, "INVALID", null, manual);
    return { ok: false, result: "INVALID" };
  }
  const fail = async (result: Exclude<ScanResult, "OK">, attemptsLeft?: number): Promise<ScanOutcome> => {
    await record(scanner, result, coupon.id, manual);
    return { ok: false, result, attemptsLeft };
  };

  // Begona biznes kupon — kassir uni sotolmaydi (kupon haqida boshqa ma'lumot qaytarilmaydi)
  if (coupon.discount.businessId !== scanner.businessId) return fail("WRONG_BUSINESS");

  const secret = decryptSecret(coupon.secret);
  if (manual) {
    if (coupon.manualAttempts >= MANUAL_MAX_ATTEMPTS) return fail("MANUAL_LOCKED");
    // Faqat statik kupon kodi hech qachon yetarli emas: 6 raqamli kod shart
    if (!(await verifyCode(input.totp.trim(), secret, nowMs))) {
      const updated = await db.coupon.update({ where: { id: coupon.id }, data: { manualAttempts: { increment: 1 } }, select: { manualAttempts: true } });
      const left = Math.max(0, MANUAL_MAX_ATTEMPTS - updated.manualAttempts);
      return fail(left === 0 ? "MANUAL_LOCKED" : "INVALID", left);
    }
  } else {
    const check = await verifyQr(parsed!, secret, nowMs);
    if (check === "invalid") return fail("INVALID");
    // Eski oyna: skrinshot yoki eski QR
    if (check === "stale") return fail("EXPIRED");
  }

  if (coupon.status === "REDEEMED") return fail("REPLAYED");
  if (coupon.status !== "ACTIVE") return fail(coupon.status === "EXPIRED" ? "EXPIRED" : "INVALID");
  if (coupon.expiresAt.getTime() <= nowMs) {
    await db.$transaction((tx) => closeCoupon(tx, coupon.id, "EXPIRED"));
    return fail("EXPIRED");
  }
  const profile = coupon.student.student;
  if (coupon.student.status !== "ACTIVE" || profile?.status !== "APPROVED") return fail("BLOCKED");

  await record(scanner, "OK", coupon.id, manual);
  const limit = coupon.discount.perStudentLimit;
  const nth =
    (await db.coupon.count({ where: { studentId: coupon.studentId, discountId: coupon.discount.id, status: "REDEEMED", date: coupon.date } })) + 1;
  const first = coupon.student.firstName ?? "";
  const last = coupon.student.lastName ?? "";
  return {
    ok: true,
    preview: {
      couponId: coupon.id,
      code: coupon.code,
      ticket: signTicket(coupon.id, scanner, nowMs),
      student: { name: [first, last].filter(Boolean).join(" "), initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase(), university: profile.university.shortName, course: profile.course },
      title: coupon.termsTitle,
      badge: snapshotBadge(coupon),
      originalPrice: coupon.termsType === "BOGO" ? coupon.termsOriginalPrice : coupon.termsFinalPrice !== null ? coupon.termsOriginalPrice : null,
      discountAmount: coupon.termsFinalPrice !== null ? coupon.termsDiscountAmount : null,
      finalPrice: coupon.termsFinalPrice,
      percent: coupon.termsType === "PERCENT" ? coupon.termsPercent : null,
      bogo: coupon.termsType === "BOGO",
      limit,
      nth,
    },
  };
}

export type ConfirmInput = {
  couponId: string;
  ticket: string;
  paymentType: PaymentType;
  /** Narxsiz chegirmada kassir kiritgan summa: foizli — chek summasi, 1+1 — bitta mahsulot narxi */
  amount?: number | null;
};

export type ConfirmResult =
  | { ok: true; redemptionId: string }
  | { ok: false; error: "ticket" | "amount" | Exclude<ScanResult, "OK"> };

export const AMOUNT_MAX = 100_000_000;

/** Snapshot (yoki kassir kiritgan summa) bo'yicha chek summalari. */
export function redemptionAmounts(
  terms: { termsType: string; termsPercent: number | null; termsOriginalPrice: number | null; termsDiscountAmount: number | null; termsFinalPrice: number | null },
  amount: number | null | undefined,
): { originalPrice: number; discountAmount: number; paidAmount: number } | null {
  if (terms.termsFinalPrice !== null && terms.termsOriginalPrice !== null && terms.termsDiscountAmount !== null) {
    return { originalPrice: terms.termsOriginalPrice, discountAmount: terms.termsDiscountAmount, paidAmount: terms.termsFinalPrice };
  }
  if (amount == null || !Number.isInteger(amount) || amount <= 0 || amount > AMOUNT_MAX) return null;
  if (terms.termsType === "BOGO") return { originalPrice: amount * 2, discountAmount: amount, paidAmount: amount };
  if (terms.termsType === "PERCENT" && terms.termsPercent !== null) {
    const paid = priceAfterPercent(amount, terms.termsPercent);
    return { originalPrice: amount, discountAmount: amount - paid, paidAmount: paid };
  }
  return null;
}

/**
 * Sotuvni tasdiqlash (B4 "Sotuvni tasdiqlash"). Ikki kassir bir vaqtda bossa — faqat bittasi o'tadi:
 * holat ACTIVE→REDEEMED shartli UPDATE bilan, ikkinchisi 0 qator oladi (REPLAYED). Muddati o'tgan bo'lsa — EXPIRED.
 */
export async function confirmRedemption(scanner: Scanner, input: ConfirmInput, now = Date.now()): Promise<ConfirmResult> {
  if (!checkTicket(input.ticket, input.couponId, scanner, now)) return { ok: false, error: "ticket" };
  const coupon = await db.coupon.findUnique({
    where: { id: input.couponId },
    select: {
      id: true, studentId: true, discountId: true, date: true,
      termsType: true, termsPercent: true, termsOriginalPrice: true, termsDiscountAmount: true, termsFinalPrice: true,
      discount: { select: { businessId: true } },
    },
  });
  if (!coupon || coupon.discount.businessId !== scanner.businessId) return { ok: false, error: "WRONG_BUSINESS" };
  const amounts = redemptionAmounts(coupon, input.amount);
  if (!amounts) return { ok: false, error: "amount" };

  const result = await db.$transaction(async (tx) => {
    const won = await tx.$executeRaw`
      UPDATE "Coupon" SET status = 'REDEEMED', "closedAt" = now()
      WHERE id = ${coupon.id} AND status = 'ACTIVE' AND "expiresAt" > now()`;
    if (won === 0) return null;
    const business = await tx.business.update({ where: { id: scanner.businessId }, data: { receiptSeq: { increment: 1 } }, select: { receiptSeq: true } });
    const redemption = await tx.redemption.create({
      data: {
        couponId: coupon.id,
        receiptNo: business.receiptSeq,
        businessId: scanner.businessId,
        discountId: coupon.discountId,
        studentId: coupon.studentId,
        cashierId: scanner.userId,
        ...amounts,
        paymentType: input.paymentType,
      },
      select: { id: true },
    });
    await tx.$executeRaw`UPDATE "DiscountDay" SET redeemed = redeemed + 1 WHERE "discountId" = ${coupon.discountId} AND date = ${coupon.date}::date`;
    return redemption.id;
  });
  if (result) return { ok: true, redemptionId: result };

  // Yutqazdi: kim/nima sabab
  const after = await db.coupon.findUniqueOrThrow({ where: { id: coupon.id }, select: { status: true, expiresAt: true } });
  const reason = after.status === "REDEEMED" ? "REPLAYED" : after.status === "ACTIVE" && after.expiresAt.getTime() <= now ? "EXPIRED" : after.status === "EXPIRED" ? "EXPIRED" : "INVALID";
  if (reason === "EXPIRED") await db.$transaction((tx) => closeCoupon(tx, coupon.id, "EXPIRED"));
  await record(scanner, reason, coupon.id, false);
  return { ok: false, error: reason };
}
