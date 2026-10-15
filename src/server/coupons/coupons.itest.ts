import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toTashkent } from "@/lib/time";
import { qrToken, totpCode, windowAt } from "@/lib/totp";
import { db } from "../db";
import { cancelCoupon, claimCoupon, closeCoupon, decryptSecret, encryptSecret, expireDueCoupons } from "./coupons";
import { receipt, receiptPdf, studentHistory } from "./receipts";
import { confirmRedemption, MANUAL_MAX_ATTEMPTS, redemptionAmounts, scanCoupon, scannerFor, type Scanner } from "./scan";

const PHONES = ["+998935559850", "+998935559851", "+998935559852", "+998935559853", "+998935559854", "+998935559855"];
const TINS = ["309109850", "309109851"];
const DAY_MS = 86_400_000;

let studentA: string;
let studentB: string;
let owner: Scanner;
let cashier: Scanner;
let stranger: Scanner;
let discountId: string;

async function cleanup() {
  const users = await db.user.findMany({ where: { phone: { in: PHONES } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.scanAttempt.deleteMany({ where: { cashierId: { in: ids } } });
  await db.redemption.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { cashierId: { in: ids } }] } });
  await db.coupon.deleteMany({ where: { studentId: { in: ids } } });
  await db.business.deleteMany({ where: { tin: { in: TINS } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

const now = () => new Date();
const today = () => toTashkent(new Date()).date;

async function makeStudent(phone: string, n: number) {
  const uni = await db.university.findFirstOrThrow();
  const user = await db.user.create({
    data: {
      phone,
      role: "STUDENT",
      firstName: "Itest",
      lastName: `Talaba${n}`,
      student: { create: { universityId: uni.id, course: "C2", publicId: `TP-ITEST-${n}`, status: "APPROVED", cardNumber: `ITEST-${n}`, cardExpiresAt: new Date(today().getTime() + 300 * DAY_MS) } },
    },
  });
  return user.id;
}

async function makeBusiness(ownerPhone: string, cashierPhone: string, tin: string) {
  const ownerUser = await db.user.create({ data: { phone: ownerPhone, role: "BUSINESS_OWNER", firstName: "Egasi", lastName: "Itest" } });
  const business = await db.business.create({
    data: { ownerId: ownerUser.id, name: `Itest ${tin}`, tin, kind: "CAFE", address: "Bunyodkor 1", workingHours: "09–22", status: "APPROVED", submittedAt: new Date() },
  });
  const cashierUser = await db.user.create({ data: { phone: cashierPhone, role: "CASHIER", firstName: "Jasur", lastName: "Toshmatov" } });
  await db.businessMember.create({ data: { businessId: business.id, userId: cashierUser.id, role: "CASHIER" } });
  return {
    business,
    owner: (await scannerFor({ id: ownerUser.id, role: "BUSINESS_OWNER" }))!,
    cashier: (await scannerFor({ id: cashierUser.id, role: "CASHIER" }))!,
  };
}

/** Hozir ochiq chegirma (oraliq joriy daqiqani o'z ichiga oladi). */
async function makeDiscount(businessId: string, over: Partial<{ dailyLimit: number; perStudentLimit: "DAILY" | "WEEKLY" | "UNLIMITED"; originalPrice: number | null; percent: number }> = {}) {
  const minute = toTashkent(new Date()).minute;
  const category = await db.category.findFirstOrThrow({ where: { slug: "taom" } });
  const d = await db.discount.create({
    data: {
      businessId,
      categoryId: category.id,
      title: "Itest osh",
      type: "PERCENT",
      originalPrice: over.originalPrice === undefined ? 38000 : over.originalPrice,
      percent: over.percent ?? 30,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      fromMinute: Math.max(0, minute - 60),
      toMinute: Math.min(1440, minute + 60),
      dailyLimit: over.dailyLimit ?? 60,
      perStudentLimit: over.perStudentLimit ?? "DAILY",
      startsOn: new Date(today().getTime() - DAY_MS),
      endsOn: new Date(today().getTime() + 10 * DAY_MS),
      status: "ACTIVE",
    },
  });
  return d.id;
}

const day = async (id: string) => db.discountDay.findUnique({ where: { discountId_date: { discountId: id, date: today() } } });
const coupon = (id: string) => db.coupon.findUniqueOrThrow({ where: { id } });

async function claimed(studentId: string, id = discountId) {
  const r = await claimCoupon(studentId, id);
  if (!r.ok) throw new Error(r.error);
  return coupon(r.couponId);
}

async function qrFor(c: { code: string; secret: Uint8Array }, shift = 0) {
  return qrToken(c.code, decryptSecret(c.secret), windowAt(Date.now()) + shift);
}

async function scanAndConfirm(scanner: Scanner, c: { code: string; secret: Uint8Array }) {
  const scan = await scanCoupon(scanner, { qr: await qrFor(c) });
  if (!scan.ok) throw new Error(scan.result);
  return confirmRedemption(scanner, { couponId: scan.preview.couponId, ticket: scan.preview.ticket, paymentType: "CASH" });
}

beforeEach(async () => {
  await cleanup();
  studentA = await makeStudent(PHONES[0]!, 1);
  studentB = await makeStudent(PHONES[1]!, 2);
  const first = await makeBusiness(PHONES[2]!, PHONES[3]!, TINS[0]!);
  const second = await makeBusiness(PHONES[4]!, PHONES[5]!, TINS[1]!);
  owner = first.owner;
  cashier = first.cashier;
  stranger = second.cashier;
  discountId = await makeDiscount(first.business.id);
});
afterAll(cleanup);

describe("kupon olish", () => {
  it("10 daqiqalik kupon, qoldiq +1, shartlar snapshot; qayta bosish o'sha kuponni qaytaradi", async () => {
    const c = await claimed(studentA);
    expect(c.status).toBe("ACTIVE");
    expect(c.expiresAt.getTime() - c.createdAt.getTime()).toBeGreaterThanOrEqual(10 * 60_000 - 2000);
    expect(c).toMatchObject({ termsTitle: "Itest osh", termsPercent: 30, termsOriginalPrice: 38000, termsFinalPrice: 26600, termsDiscountAmount: 11400 });
    expect(decryptSecret(c.secret)).toHaveLength(20);
    expect((await day(discountId))?.claimed).toBe(1);

    const again = await claimCoupon(studentA, discountId);
    expect(again).toEqual({ ok: true, couponId: c.id, existing: true });
    expect((await day(discountId))?.claimed).toBe(1);
  });

  it("secret bazada shifrlangan (ochiq holda emas)", () => {
    const secret = new Uint8Array(20).fill(7);
    const stored = encryptSecret(secret);
    expect(Buffer.from(stored).includes(Buffer.from(secret))).toBe(false);
    expect(decryptSecret(stored)).toEqual(secret);
  });

  it("kunlik qoldiq tugasa — soldOut; bekor qilinsa yana olinadi", async () => {
    const limited = await makeDiscount(owner.businessId, { dailyLimit: 1 });
    const c = await claimed(studentA, limited);
    expect(await claimCoupon(studentB, limited)).toEqual({ ok: false, error: "soldOut" });
    expect(await cancelCoupon(studentA, c.id)).toBe(true);
    expect((await claimCoupon(studentB, limited)).ok).toBe(true);
  });

  it("parallel olishda kunlik limitdan oshmaydi", async () => {
    const limited = await makeDiscount(owner.businessId, { dailyLimit: 1 });
    const results = await Promise.all([claimCoupon(studentA, limited), claimCoupon(studentB, limited)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await day(limited))?.claimed).toBe(1);
  });

  it("talaba limiti (kuniga 1): sotilgandan keyin bugun yana olinmaydi; bekor qilingani hisoblanmaydi", async () => {
    const c = await claimed(studentA);
    await cancelCoupon(studentA, c.id);
    const second = await claimed(studentA);
    expect((await scanAndConfirm(cashier, second)).ok).toBe(true);
    expect(await claimCoupon(studentA, discountId)).toEqual({ ok: false, error: "limit" });
    // Cheklanmagan chegirmada — mumkin
    const free = await makeDiscount(owner.businessId, { perStudentLimit: "UNLIMITED" });
    const f1 = await claimed(studentA, free);
    expect((await scanAndConfirm(cashier, f1)).ok).toBe(true);
    expect((await claimCoupon(studentA, free)).ok).toBe(true);
  });

  it("tasdiqlanmagan / bloklangan talaba va yopiq chegirma olmaydi", async () => {
    await db.studentProfile.update({ where: { userId: studentB }, data: { status: "EXPIRED" } });
    expect(await claimCoupon(studentB, discountId)).toEqual({ ok: false, error: "notStudent" });
    await db.discount.update({ where: { id: discountId }, data: { status: "PAUSED" } });
    expect(await claimCoupon(studentA, discountId)).toEqual({ ok: false, error: "notAvailable" });
  });
});

describe("qoldiq qaytishi", () => {
  it("bekor qilish bir marta qaytaradi, ikkinchi marta emas", async () => {
    const c = await claimed(studentA);
    expect(await cancelCoupon(studentA, c.id)).toBe(true);
    expect(await cancelCoupon(studentA, c.id)).toBe(false);
    expect((await day(discountId))?.claimed).toBe(0);
    // Begona talaba boshqaning kuponini bekor qila olmaydi
    const d = await claimed(studentA);
    expect(await cancelCoupon(studentB, d.id)).toBe(false);
  });

  it("eskirish (lazy) qaytaradi; sotilgani qaytmaydi", async () => {
    const c = await claimed(studentA);
    const sold = await claimed(studentB);
    expect((await scanAndConfirm(cashier, sold)).ok).toBe(true);
    await db.coupon.updateMany({ where: { id: { in: [c.id, sold.id] } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await expireDueCoupons({ discountId })).toBe(1);
    expect((await coupon(c.id)).status).toBe("EXPIRED");
    expect((await coupon(sold.id)).status).toBe("REDEEMED");
    expect(await day(discountId)).toMatchObject({ claimed: 1, redeemed: 1 });
    expect(await expireDueCoupons({ discountId })).toBe(0);
  });

  it("eskirish ↔ tasdiqlash poygasi: muddati o'tgan kupon sotilmaydi, qoldiq bir marta qaytadi", async () => {
    const c = await claimed(studentA);
    const scan = await scanCoupon(cashier, { qr: await qrFor(c) });
    if (!scan.ok) throw new Error(scan.result);
    await db.coupon.update({ where: { id: c.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const [confirm, expired] = await Promise.all([
      confirmRedemption(cashier, { couponId: c.id, ticket: scan.preview.ticket, paymentType: "CASH" }),
      db.$transaction((tx) => closeCoupon(tx, c.id, "EXPIRED")),
    ]);
    expect(confirm).toEqual({ ok: false, error: "EXPIRED" });
    expect(typeof expired).toBe("boolean");
    expect((await coupon(c.id)).status).toBe("EXPIRED");
    expect(await day(discountId)).toMatchObject({ claimed: 0, redeemed: 0 });
    expect(await db.redemption.count({ where: { couponId: c.id } })).toBe(0);
  });

  it("muddati ichida tasdiqlangan kuponni keyingi eskirish yopmaydi", async () => {
    const c = await claimed(studentA);
    expect((await scanAndConfirm(cashier, c)).ok).toBe(true);
    expect(await db.$transaction((tx) => closeCoupon(tx, c.id, "EXPIRED"))).toBe(false);
    expect(await db.$transaction((tx) => closeCoupon(tx, c.id, "CANCELLED"))).toBe(false);
    expect(await day(discountId)).toMatchObject({ claimed: 1, redeemed: 1 });
  });
});

describe("skan va tasdiqlash", () => {
  it("QR → tasdiqlash → chek; takror skan — REPLAYED", async () => {
    const c = await claimed(studentA);
    const result = await scanAndConfirm(cashier, c);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = await receipt(result.redemptionId);
    expect(r?.data).toMatchObject({ originalPrice: 38000, discountAmount: 11400, paidAmount: 26600, badge: "−30%", cashier: "Jasur T.", paymentType: "CASH" });
    expect(await day(discountId)).toMatchObject({ claimed: 1, redeemed: 1 });

    expect(await scanCoupon(cashier, { qr: await qrFor(c) })).toEqual({ ok: false, result: "REPLAYED" });
  });

  it("±1 oyna o'tadi; eskirgan oyna — EXPIRED; noto'g'ri secret — INVALID", async () => {
    const c = await claimed(studentA);
    expect((await scanCoupon(cashier, { qr: await qrFor(c, -1) })).ok).toBe(true);
    expect((await scanCoupon(cashier, { qr: await qrFor(c, 1) })).ok).toBe(true);
    expect(await scanCoupon(cashier, { qr: await qrFor(c, -2) })).toEqual({ ok: false, result: "EXPIRED" });
    const forged = await qrToken(c.code, new Uint8Array(20).fill(1), windowAt(Date.now()));
    expect(await scanCoupon(cashier, { qr: forged })).toEqual({ ok: false, result: "INVALID" });
    expect(await scanCoupon(cashier, { qr: "salom" })).toEqual({ ok: false, result: "INVALID" });
  });

  it("muddati o'tgan kupon — EXPIRED va qoldiq qaytadi", async () => {
    const c = await claimed(studentA);
    await db.coupon.update({ where: { id: c.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await scanCoupon(cashier, { qr: await qrFor(c) })).toEqual({ ok: false, result: "EXPIRED" });
    expect((await coupon(c.id)).status).toBe("EXPIRED");
    expect((await day(discountId))?.claimed).toBe(0);
  });

  it("begona biznes kassiri — WRONG_BUSINESS (tasdiqlash ham)", async () => {
    const c = await claimed(studentA);
    expect(await scanCoupon(stranger, { qr: await qrFor(c) })).toEqual({ ok: false, result: "WRONG_BUSINESS" });
    const scan = await scanCoupon(cashier, { qr: await qrFor(c) });
    if (!scan.ok) throw new Error(scan.result);
    // Boshqa kassir uchun berilgan "ticket" ishlamaydi
    expect(await confirmRedemption(stranger, { couponId: c.id, ticket: scan.preview.ticket, paymentType: "CASH" })).toEqual({ ok: false, error: "ticket" });
    expect((await coupon(c.id)).status).toBe("ACTIVE");
  });

  it("o'chirilgan kassir skanerlay olmaydi", async () => {
    await db.businessMember.updateMany({ where: { userId: cashier.userId }, data: { active: false } });
    expect(await scannerFor({ id: cashier.userId, role: "CASHIER" })).toBeNull();
  });

  it("parallel tasdiqlash (ikki kassir) — faqat bittasi o'tadi", async () => {
    const c = await claimed(studentA);
    const [a, b] = await Promise.all([scanCoupon(owner, { qr: await qrFor(c) }), scanCoupon(cashier, { qr: await qrFor(c) })]);
    if (!a.ok || !b.ok) throw new Error("scan");
    const results = await Promise.all([
      confirmRedemption(owner, { couponId: c.id, ticket: a.preview.ticket, paymentType: "CASH" }),
      confirmRedemption(cashier, { couponId: c.id, ticket: b.preview.ticket, paymentType: "CARD" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: "REPLAYED" });
    expect(await db.redemption.count({ where: { couponId: c.id } })).toBe(1);
    expect(await day(discountId)).toMatchObject({ claimed: 1, redeemed: 1 });
  });

  it("chegirma keyin o'zgarsa ham kupon olingan paytdagi shartlarda sotiladi", async () => {
    const c = await claimed(studentA);
    await db.discount.update({ where: { id: discountId }, data: { percent: 10, originalPrice: 50000 } });
    const result = await scanAndConfirm(cashier, c);
    if (!result.ok) throw new Error(result.error);
    expect((await receipt(result.redemptionId))?.data).toMatchObject({ originalPrice: 38000, paidAmount: 26600, badge: "−30%" });
  });

  it("narxsiz chegirma: kassir chek summasini kiritadi", async () => {
    const check = await makeDiscount(owner.businessId, { originalPrice: null, percent: 15 });
    const c = await claimed(studentA, check);
    const scan = await scanCoupon(cashier, { qr: await qrFor(c) });
    if (!scan.ok) throw new Error(scan.result);
    expect(scan.preview.finalPrice).toBeNull();
    expect(await confirmRedemption(cashier, { couponId: c.id, ticket: scan.preview.ticket, paymentType: "CASH" })).toEqual({ ok: false, error: "amount" });
    const result = await confirmRedemption(cashier, { couponId: c.id, ticket: scan.preview.ticket, paymentType: "CASH", amount: 80000 });
    if (!result.ok) throw new Error(result.error);
    expect((await receipt(result.redemptionId))?.data).toMatchObject({ originalPrice: 80000, discountAmount: 12000, paidAmount: 68000 });
  });
});

describe("qo'lda kiritish", () => {
  it("kupon kodi + 6 raqamli kod o'tadi; 6 raqamsiz — rad", async () => {
    const c = await claimed(studentA);
    expect(await scanCoupon(cashier, { code: c.code, totp: "" })).toMatchObject({ ok: false, result: "INVALID" });
    const totp = await totpCode(decryptSecret(c.secret), windowAt(Date.now()));
    expect((await scanCoupon(cashier, { code: c.code.toLowerCase().replace(/-/g, " "), totp })).ok).toBe(true);
  });

  it("5 ta xato → qo'lda kiritish yopiladi (to'g'ri kod ham o'tmaydi), QR ishlayveradi", async () => {
    const c = await claimed(studentA);
    const right = await totpCode(decryptSecret(c.secret), windowAt(Date.now()));
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 1; i < MANUAL_MAX_ATTEMPTS; i++) {
      expect(await scanCoupon(cashier, { code: c.code, totp: wrong })).toEqual({ ok: false, result: "INVALID", attemptsLeft: MANUAL_MAX_ATTEMPTS - i });
    }
    expect(await scanCoupon(cashier, { code: c.code, totp: wrong })).toMatchObject({ ok: false, result: "MANUAL_LOCKED" });
    expect(await scanCoupon(cashier, { code: c.code, totp: right })).toMatchObject({ ok: false, result: "MANUAL_LOCKED" });
    expect((await scanCoupon(cashier, { qr: await qrFor(c) })).ok).toBe(true);
  });
});

describe("ScanAttempt va chek", () => {
  it("har bir urinish yoziladi (muvaffaqiyatlisi ham)", async () => {
    const c = await claimed(studentA);
    await scanCoupon(cashier, { qr: "noto'g'ri" });
    await scanCoupon(stranger, { qr: await qrFor(c) });
    await scanCoupon(cashier, { qr: await qrFor(c) });
    const attempts = await db.scanAttempt.findMany({ where: { cashierId: { in: [cashier.userId, stranger.userId] } }, orderBy: { createdAt: "asc" }, select: { result: true, businessId: true } });
    expect(attempts.map((a) => a.result)).toEqual(["INVALID", "WRONG_BUSINESS", "OK"]);
    expect(attempts[1]!.businessId).toBe(stranger.businessId);
  });

  it("tarix va PDF", async () => {
    const c = await claimed(studentA);
    const result = await scanAndConfirm(cashier, c);
    if (!result.ok) throw new Error(result.error);
    const history = await studentHistory(studentA, null);
    expect(history).toMatchObject({ count: 1, saved: 11400, totalSaved: 11400, places: 1 });
    const r = (await receipt(result.redemptionId))!.data;
    const pdf = await receiptPdf(r, { title: "Chek", no: "Chek №", date: "Sana", student: "Talaba", cashier: "Kassir", discount: "Chegirma", total: "JAMI", payment: "To'lov", paymentType: "Naqd", currency: "so'm", footer: "talabaPass" });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("summa hisobi (sof)", () => {
    const base = { termsType: "PERCENT", termsPercent: 15, termsOriginalPrice: null, termsDiscountAmount: null, termsFinalPrice: null };
    expect(redemptionAmounts(base, 40000)).toEqual({ originalPrice: 40000, discountAmount: 6000, paidAmount: 34000 });
    expect(redemptionAmounts(base, 0)).toBeNull();
    expect(redemptionAmounts({ ...base, termsType: "BOGO", termsPercent: null }, 32000)).toEqual({ originalPrice: 64000, discountAmount: 32000, paidAmount: 32000 });
    expect(now()).toBeInstanceOf(Date);
  });
});
