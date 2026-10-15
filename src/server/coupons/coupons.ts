import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { discountTerms } from "@/lib/discount";
import { dealTiming, toTashkent, weekdayOf } from "@/lib/time";
import { toBase64Url } from "@/lib/totp";
import { Prisma, type CouponStatus } from "@/generated/prisma/client";
import { db } from "../db";
import { authSecret } from "../env";
import { visibleDiscountWhere } from "../student/feed";

/**
 * Kupon hayoti: olish (online, tranzaksiyada) → ko'rsatish (offline TOTP, src/lib/totp) → skan/tasdiqlash (scan.ts)
 * yoki bekor qilish / eskirish. Kunlik qoldiq (`DiscountDay.claimed`) olishda +1, bekor/eskirganda −1 —
 * faqat holat haqiqatan ACTIVE dan o'zgargan bo'lsa (bir marta, ikki marta emas; sotilgani qaytmaydi).
 */

export const COUPON_TTL_MS = 10 * 60_000;
const SECRET_BYTES = 20; // 160 bit
const DAY_MS = 86_400_000;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

type Tx = Prisma.TransactionClient;

// ───────── secret: bazada AES-256-GCM bilan shifrlangan ─────────

const secretKey = () => createHash("sha256").update(`tp-coupon-secret:${authSecret()}`).digest();

/** iv(12) | shifrlangan | tag(16) */
export function encryptSecret(secret: Uint8Array): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return new Uint8Array(Buffer.concat([iv, body, cipher.getAuthTag()]));
}

export function decryptSecret(stored: Uint8Array): Uint8Array {
  const buf = Buffer.from(stored);
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(buf.length - 16));
  return new Uint8Array(Buffer.concat([decipher.update(buf.subarray(12, buf.length - 16)), decipher.final()]));
}

export function newCouponCode(): string {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `TP-${part()}-${part()}`;
}

// ───────── yopish (bekor qilish / eskirish) — yagona joy ─────────

/**
 * Faol kuponni yopadi va kunlik qoldiqni qaytaradi — shu tranzaksiyada. `UPDATE … WHERE status='ACTIVE'`
 * 1 qator o'zgartirsagina qoldiq −1: ikkinchi chaqiruv yoki sotilgan kupon hech narsani qaytarmaydi.
 * Eskirish faqat muddati haqiqatan o'tgan bo'lsa (tasdiqlash bilan poyga — qaysi biri birinchi bo'lsa o'sha).
 */
export async function closeCoupon(tx: Tx, couponId: string, status: Extract<CouponStatus, "CANCELLED" | "EXPIRED">): Promise<boolean> {
  const closed = await tx.$queryRaw<{ discountId: string; date: Date }[]>`
    UPDATE "Coupon" SET status = ${status}::"CouponStatus", "closedAt" = now()
    WHERE id = ${couponId} AND status = 'ACTIVE' ${status === "EXPIRED" ? Prisma.sql`AND "expiresAt" <= now()` : Prisma.empty}
    RETURNING "discountId", date`;
  if (closed.length === 0) return false;
  await tx.$executeRaw`
    UPDATE "DiscountDay" SET claimed = claimed - 1
    WHERE "discountId" = ${closed[0]!.discountId} AND date = ${closed[0]!.date}::date AND claimed > redeemed`;
  return true;
}

/** Muddati o'tgan faol kuponlarni yopish (cron va har "olish" oldidan, lazy). Har biri o'z tranzaksiyasida. */
export async function expireDueCoupons(where: Prisma.CouponWhereInput = {}, limit = 500): Promise<number> {
  const due = await db.coupon.findMany({
    where: { AND: [where, { status: "ACTIVE", expiresAt: { lte: new Date() } }] },
    select: { id: true },
    take: limit,
  });
  let closed = 0;
  for (const { id } of due) {
    if (await db.$transaction((tx) => closeCoupon(tx, id, "EXPIRED"))) closed++;
  }
  return closed;
}

/** Talaba o'z faol kuponini bekor qiladi (T6 / WT3 "Kuponni bekor qilish"). */
export async function cancelCoupon(studentId: string, couponId: string): Promise<boolean> {
  const coupon = await db.coupon.findFirst({ where: { id: couponId, studentId }, select: { id: true } });
  if (!coupon) return false;
  return db.$transaction((tx) => closeCoupon(tx, coupon.id, "CANCELLED"));
}

// ───────── olish ─────────

export type ClaimError = "notAvailable" | "closed" | "soldOut" | "limit" | "notStudent";
export type ClaimResult = { ok: true; couponId: string; existing: boolean } | { ok: false; error: ClaimError };

/** Haftaning dushanbasi (Toshkent sanasi) — WEEKLY limit uchun. */
const weekStart = (date: Date) => new Date(date.getTime() - (weekdayOf(date) - 1) * DAY_MS);

/**
 * Kupon olish: talaba faol, chegirma talabaga ko'rinadi va hozir ochiq, talaba limiti va kunlik qoldiq bor →
 * `DiscountDay.claimed + 1` (shartli, atom) va 10 daqiqalik kupon — bitta tranzaksiyada.
 * Shu chegirmada faol kupon bo'lsa — o'sha qaytariladi (qayta bosish ikkinchi kupon ochmaydi).
 */
export async function claimCoupon(studentId: string, discountId: string, now = new Date()): Promise<ClaimResult> {
  // Lazy tozalash: bu chegirmaning eskirgan kuponlari qoldiqni qaytaradi
  await expireDueCoupons({ discountId });

  const existing = await db.coupon.findFirst({ where: { studentId, discountId, status: "ACTIVE", expiresAt: { gt: now } }, select: { id: true } });
  if (existing) return { ok: true, couponId: existing.id, existing: true };

  const student = await db.studentProfile.findUnique({ where: { userId: studentId }, select: { status: true, cardExpiresAt: true, user: { select: { status: true } } } });
  const today = toTashkent(now).date;
  if (!student || student.status !== "APPROVED" || student.user.status !== "ACTIVE" || (student.cardExpiresAt && student.cardExpiresAt < today)) {
    return { ok: false, error: "notStudent" };
  }

  const discount = await db.discount.findFirst({
    where: { AND: [{ id: discountId }, visibleDiscountWhere(now)] },
    select: {
      id: true, title: true, type: true, originalPrice: true, percent: true, newPrice: true, note: true,
      weekdays: true, fromMinute: true, toMinute: true, startsOn: true, endsOn: true, dailyLimit: true, perStudentLimit: true,
    },
  });
  if (!discount) return { ok: false, error: "notAvailable" };
  const timing = dealTiming(discount, now);
  if (!timing?.live) return { ok: false, error: "closed" };
  const date = timing.windowDate;

  try {
    return await db.$transaction(async (tx) => {
      if (discount.perStudentLimit !== "UNLIMITED") {
        const from = discount.perStudentLimit === "DAILY" ? date : weekStart(date);
        const to = discount.perStudentLimit === "DAILY" ? date : new Date(from.getTime() + 6 * DAY_MS);
        const used = await tx.coupon.count({ where: { studentId, discountId, status: { in: ["ACTIVE", "REDEEMED"] }, date: { gte: from, lte: to } } });
        if (used > 0) return { ok: false, error: "limit" } as const;
      }

      await tx.$executeRaw`INSERT INTO "DiscountDay" ("discountId", date, claimed, redeemed) VALUES (${discount.id}, ${date}::date, 0, 0) ON CONFLICT DO NOTHING`;
      const taken = await tx.$executeRaw`
        UPDATE "DiscountDay" SET claimed = claimed + 1
        WHERE "discountId" = ${discount.id} AND date = ${date}::date AND claimed < ${discount.dailyLimit}`;
      if (taken === 0) return { ok: false, error: "soldOut" } as const;

      // Shartlar snapshot: chegirma keyin tahrirlansa ham kupon shu shartlarda bajariladi
      const terms = discountTerms(discount);
      const coupon = await tx.coupon.create({
        data: {
          code: newCouponCode(),
          discountId: discount.id,
          studentId,
          date,
          secret: encryptSecret(randomBytes(SECRET_BYTES)),
          expiresAt: new Date(now.getTime() + COUPON_TTL_MS),
          termsTitle: discount.title,
          termsType: discount.type,
          termsPercent: discount.percent,
          termsNote: discount.note,
          termsOriginalPrice: terms.originalPrice,
          termsDiscountAmount: terms.discountAmount,
          termsFinalPrice: terms.finalPrice,
        },
        select: { id: true },
      });
      return { ok: true, couponId: coupon.id, existing: false } as const;
    });
  } catch (error) {
    // Parallel ikkinchi bosish: (studentId, discountId) bo'yicha faol kupon bitta (qisman unique indeks)
    if ((error as { code?: string }).code === "P2002") {
      const active = await db.coupon.findFirst({ where: { studentId, discountId, status: "ACTIVE" }, select: { id: true } });
      if (active) return { ok: true, couponId: active.id, existing: true };
    }
    throw error;
  }
}

// ───────── talabaga ko'rsatish ─────────

export type CouponView = {
  id: string;
  code: string;
  /** base64url — faqat kupon egasiga; QR va kod shu bilan qurilmada hisoblanadi */
  secret: string;
  /** ISO */
  expiresAt: string;
  title: string;
  store: string;
  badge: string;
  price: { now: number; old: number | null } | null;
  note: string | null;
  student: { name: string; initials: string; university: string; course: string };
};

const COUPON_SELECT = {
  id: true,
  code: true,
  secret: true,
  expiresAt: true,
  termsTitle: true,
  termsType: true,
  termsPercent: true,
  termsNote: true,
  termsOriginalPrice: true,
  termsFinalPrice: true,
  termsDiscountAmount: true,
  discount: { select: { originalPrice: true, newPrice: true, business: { select: { name: true } } } },
  student: { select: { firstName: true, lastName: true, student: { select: { course: true, university: { select: { shortName: true } } } } } },
} satisfies Prisma.CouponSelect;

type CouponRow = Prisma.CouponGetPayload<{ select: typeof COUPON_SELECT }>;

/** Kupon yorlig'i snapshot'dan (chegirma keyin o'zgargan bo'lsa ham). */
export function snapshotBadge(c: Pick<CouponRow, "termsType" | "termsPercent" | "termsOriginalPrice" | "termsFinalPrice">): string {
  return discountTerms({
    type: c.termsType,
    percent: c.termsPercent,
    originalPrice: c.termsType === "BOGO" && c.termsOriginalPrice !== null ? c.termsOriginalPrice / 2 : c.termsOriginalPrice,
    newPrice: c.termsType === "FIXED_PRICE" ? c.termsFinalPrice : null,
  }).badge;
}

function toView(c: CouponRow): CouponView {
  const priced = c.termsType !== "BOGO" && c.termsFinalPrice !== null && c.termsFinalPrice > 0;
  const first = c.student.firstName ?? "";
  const last = c.student.lastName ?? "";
  return {
    id: c.id,
    code: c.code,
    secret: toBase64Url(decryptSecret(c.secret)),
    expiresAt: c.expiresAt.toISOString(),
    title: c.termsTitle,
    store: c.discount.business.name,
    badge: snapshotBadge(c),
    price: priced ? { now: c.termsFinalPrice!, old: c.termsOriginalPrice } : null,
    note: priced ? null : c.termsNote,
    student: {
      name: [first, last].filter(Boolean).join(" "),
      initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase(),
      university: c.student.student?.university.shortName ?? "",
      course: c.student.student?.course ?? "C1",
    },
  };
}

/** Talabaning o'z faol kuponi (T6 / WT3 QR paneli). Eskirgan bo'lsa shu yerda yopiladi. */
export async function studentCoupon(studentId: string, couponId: string): Promise<CouponView | null> {
  const row = await db.coupon.findFirst({ where: { id: couponId, studentId, status: "ACTIVE" }, select: COUPON_SELECT });
  if (!row) return null;
  if (row.expiresAt <= new Date()) {
    await db.$transaction((tx) => closeCoupon(tx, row.id, "EXPIRED"));
    return null;
  }
  return toView(row);
}

/** Talabaning faol kuponlari (yangisi oldin). Avval eskirganlari yopiladi. */
export async function activeCoupons(studentId: string): Promise<CouponView[]> {
  await expireDueCoupons({ studentId });
  const rows = await db.coupon.findMany({ where: { studentId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: COUPON_SELECT });
  return rows.map(toView);
}

export async function activeCouponFor(studentId: string, discountId: string): Promise<CouponView | null> {
  const row = await db.coupon.findFirst({ where: { studentId, discountId, status: "ACTIVE", expiresAt: { gt: new Date() } }, select: { id: true } });
  return row ? studentCoupon(studentId, row.id) : null;
}

export async function activeCouponCount(studentId: string): Promise<number> {
  return db.coupon.count({ where: { studentId, status: "ACTIVE", expiresAt: { gt: new Date() } } });
}
