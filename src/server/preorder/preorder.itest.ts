import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/payments";
import { fromTashkent, toTashkent } from "@/lib/time";
import { totpCode, windowAt } from "@/lib/totp";
import { decryptSecret } from "../coupons/coupons";
import { scannerFor, type Scanner } from "../coupons/scan";
import { db } from "../db";
import { createOrder, handlePaymentCallback, runOrderAutomation, transitionOrder, NO_SHOW_GRACE_MS } from "./orders";
import { completeOrderScan, scanOrder } from "./scan";
import { bookingAvailability } from "./settings";
import { cancelOrderByStudent, decideOrder } from "./views";

// Oldindan band qilish: atom slot sig'imi, holat mashinasi, pul qoidasi, avtomatika, kassir.
const STUDENTS = 20;
const PHONES = Array.from({ length: STUDENTS }, (_, i) => `+9989355597${String(i).padStart(2, "0")}`);
const OWNER_PHONES = ["+998935559790", "+998935559791", "+998935559792"];
const TINS = ["309109790", "309109791"];
const DAY_MS = 86_400_000;

let students: string[] = [];
let ownerId: string;
let businessId: string;
let otherOwnerId: string;
let cashier: Scanner;
let discountId: string;

const tomorrow = () => new Date(toTashkent(new Date()).date.getTime() + DAY_MS);
/** Ertangi slot: 12:00 + n soat (Toshkent) */
const slotAt = (n = 0) => fromTashkent(tomorrow(), 12 * 60 + n * 60);

async function cleanup() {
  const users = await db.user.findMany({ where: { phone: { in: [...PHONES, ...OWNER_PHONES] } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const orders = await db.order.findMany({ where: { studentId: { in: ids } }, select: { id: true } });
  await db.auditLog.deleteMany({ where: { entity: "Order", entityId: { in: orders.map((o) => o.id) } } });
  await db.order.deleteMany({ where: { studentId: { in: ids } } });
  await db.scanAttempt.deleteMany({ where: { cashierId: { in: ids } } });
  await db.notification.deleteMany({ where: { audience: "USER", audienceIds: { hasSome: ids } } });
  await db.business.deleteMany({ where: { tin: { in: TINS } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

type SettingsOver = {
  slotCapacity: number;
  autoConfirm: boolean;
  prepay: "FULL" | "PARTIAL" | "NONE";
  keepPercent: number;
  freeCancelMinutes: number;
  schedule: { day: number; from: number; to: number }[];
  daysAhead: number;
  pausedOn: Date | null;
};

async function setSettings(over: Partial<SettingsOver> = {}) {
  const data = {
    enabled: true,
    mode: "BOTH" as const,
    schedule: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 0, to: 1440 })),
    slotMinutes: 60,
    slotCapacity: 10,
    leadMinutes: 0,
    daysAhead: 1,
    prepay: "FULL" as const,
    prepayPercent: 50,
    freeCancelMinutes: 60,
    keepPercent: 30,
    autoConfirm: true,
    pausedOn: null as Date | null,
    ...over,
  };
  await db.preorderSettings.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
}

const book = (student: string, slot = slotAt(), quantity = 1) =>
  createOrder(student, { discountId, mode: "PICKUP", slotStart: slot.toISOString(), quantity, phone: "+998901234567" });

/** Soxta provayder orqali to'lov (callback imzosi haqiqiy oqimdagidek) */
async function pay(orderId: string, status: "HELD" | "FAILED" = "HELD") {
  const payment = await db.payment.findUniqueOrThrow({ where: { orderId } });
  const { body, headers } = mockProvider().signedCallback({ providerPaymentId: payment.providerPaymentId!, status, amount: payment.amount });
  return handlePaymentCallback("mock", body, headers);
}

const statusOf = async (orderId: string) => (await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })).status;
const paymentOf = (orderId: string) => db.payment.findUniqueOrThrow({ where: { orderId } });
const booked = async (slot = slotAt()) => (await db.preorderSlot.findUnique({ where: { businessId_startsAt: { businessId, startsAt: slot } } }))?.booked ?? 0;

beforeAll(async () => {
  await cleanup();
  const uni = await db.university.findFirstOrThrow();
  const today = toTashkent(new Date()).date;
  students = [];
  for (const [i, phone] of PHONES.entries()) {
    const user = await db.user.create({
      data: {
        phone,
        role: "STUDENT",
        firstName: "Itest",
        lastName: `Bron${i}`,
        student: { create: { universityId: uni.id, course: "C2", publicId: `TP-ITBRON-${i}`, status: "APPROVED", cardNumber: `ITBRON-${i}`, cardExpiresAt: new Date(today.getTime() + 300 * DAY_MS) } },
      },
    });
    students.push(user.id);
  }
  const owner = await db.user.create({ data: { phone: OWNER_PHONES[0]!, role: "BUSINESS_OWNER", firstName: "Egasi", lastName: "Bron" } });
  ownerId = owner.id;
  const business = await db.business.create({ data: { ownerId, name: "Itest Bron", tin: TINS[0], kind: "CAFE", address: "Bunyodkor 1", workingHours: "09–22", status: "APPROVED", submittedAt: new Date() } });
  businessId = business.id;
  const cashierUser = await db.user.create({ data: { phone: OWNER_PHONES[1]!, role: "CASHIER", firstName: "Kassir", lastName: "Bron" } });
  await db.businessMember.create({ data: { businessId, userId: cashierUser.id, role: "CASHIER" } });
  cashier = (await scannerFor({ id: cashierUser.id, role: "CASHIER" }))!;
  const other = await db.user.create({ data: { phone: OWNER_PHONES[2]!, role: "BUSINESS_OWNER", firstName: "Begona", lastName: "Egasi" } });
  otherOwnerId = other.id;
  await db.business.create({ data: { ownerId: otherOwnerId, name: "Itest Begona", tin: TINS[1], kind: "CAFE", address: "Chilonzor 1", workingHours: "09–22", status: "APPROVED", submittedAt: new Date() } });
  const category = await db.category.findFirstOrThrow({ where: { slug: "taom" } });
  const discount = await db.discount.create({
    data: {
      businessId,
      categoryId: category.id,
      title: "Itest lag'mon",
      type: "FIXED_PRICE",
      originalPrice: 40_000,
      newPrice: 30_000,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      fromMinute: 0,
      toMinute: 1439,
      dailyLimit: 100,
      startsOn: new Date(today.getTime() - DAY_MS),
      endsOn: new Date(today.getTime() + 10 * DAY_MS),
      status: "ACTIVE",
      preorder: true,
    },
  });
  discountId = discount.id;
});

beforeEach(async () => {
  const ids = (await db.order.findMany({ where: { businessId }, select: { id: true } })).map((o) => o.id);
  await db.auditLog.deleteMany({ where: { entity: "Order", entityId: { in: ids } } });
  await db.order.deleteMany({ where: { businessId } });
  await db.preorderSlot.deleteMany({ where: { businessId } });
  await setSettings();
});

afterAll(cleanup);

describe("slot sig'imi (atom)", () => {
  it("20 ta parallel so'rov 10 sig'imli slotga — aynan 10 tasi o'tadi", async () => {
    const results = await Promise.all(students.map((s) => book(s)));
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(results.filter((r) => !r.ok && r.error === "slotFull")).toHaveLength(10);
    expect(await booked()).toBe(10);
    expect(await db.order.count({ where: { businessId, slotStart: slotAt() } })).toBe(10);
  });

  it("bekor qilinsa joy bir marta bo'shaydi; sig'im yana to'ladi", async () => {
    const first = await book(students[0]!);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await setSettings({ slotCapacity: 1 });
    expect((await book(students[1]!)).ok).toBe(false);
    expect((await cancelOrderByStudent(students[0]!, first.orderId)).ok).toBe(true);
    // ikkinchi bekor — ruxsat yo'q (yakuniy holat), joy ikki marta qaytmaydi
    expect(await cancelOrderByStudent(students[0]!, first.orderId)).toEqual({ ok: false, error: "forbidden" });
    expect(await booked()).toBe(0);
    expect((await book(students[1]!)).ok).toBe(true);
    expect(await booked()).toBe(1);
  });

  it("o'chiq biznes, belgisiz chegirma, jadvalda yo'q slot — band qilinmaydi", async () => {
    await db.preorderSettings.update({ where: { businessId }, data: { enabled: false } });
    expect(await book(students[0]!)).toEqual({ ok: false, error: "notAvailable" });
    await setSettings();
    await db.discount.update({ where: { id: discountId }, data: { preorder: false } });
    expect(await book(students[0]!)).toEqual({ ok: false, error: "notAvailable" });
    await db.discount.update({ where: { id: discountId }, data: { preorder: true } });
    expect(await book(students[0]!, new Date(slotAt().getTime() + 15 * 60_000))).toEqual({ ok: false, error: "slot" });
  });
});

describe("holat o'tishlari", () => {
  it("ruxsat etilmagan o'tish rad etiladi va holat o'zgarmaydi", async () => {
    const order = await book(students[0]!);
    if (!order.ok) throw new Error("band qilinmadi");
    // to'lanmagan buyurtmani biznes tasdiqlay olmaydi, kassir bera olmaydi
    expect(await decideOrder(ownerId, order.orderId, "accept")).toEqual({ ok: false, error: "forbidden" });
    expect(await transitionOrder({ orderId: order.orderId, to: "COMPLETED", actor: "cashier", actorId: cashier.userId, scope: { businessId } })).toEqual({ ok: false, error: "forbidden" });
    // begona biznes egasi — buyurtma "topilmaydi"
    expect(await decideOrder(otherOwnerId, order.orderId, "reject", "yo'q")).toEqual({ ok: false, error: "notFound" });
    // boshqa talaba bekor qila olmaydi
    expect(await cancelOrderByStudent(students[1]!, order.orderId)).toEqual({ ok: false, error: "notFound" });
    expect(await statusOf(order.orderId)).toBe("PENDING_PAYMENT");
  });

  it("har o'zgarish vaqt chizig'i va audit'ga yoziladi", async () => {
    await setSettings({ autoConfirm: false });
    const order = await book(students[0]!);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    expect((await decideOrder(ownerId, order.orderId, "accept")).ok).toBe(true);
    expect((await decideOrder(ownerId, order.orderId, "ready")).ok).toBe(true);
    const events = await db.orderEvent.findMany({ where: { orderId: order.orderId }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => [e.from, e.to])).toEqual([
      [null, "PENDING_PAYMENT"],
      ["PENDING_PAYMENT", "PAID"],
      ["PAID", "CONFIRMED"],
      ["CONFIRMED", "READY"],
    ]);
    expect(events.at(-1)!.actorId).toBe(ownerId);
    const audits = await db.auditLog.findMany({ where: { entity: "Order", entityId: order.orderId, action: "order.transition" } });
    expect(audits).toHaveLength(3);
  });

  it("narx snapshot: chegirma narxi o'zgarsa eski buyurtma o'zgarmaydi", async () => {
    const order = await book(students[0]!, slotAt(), 2);
    if (!order.ok) throw new Error("band qilinmadi");
    await db.discount.update({ where: { id: discountId }, data: { newPrice: 35_000 } });
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect([saved.unitFinal, saved.totalFinal, saved.prepayAmount]).toEqual([30_000, 60_000, 60_000]);
    await db.discount.update({ where: { id: discountId }, data: { newPrice: 30_000 } });
  });
});

describe("pul qoidasi", () => {
  it("to'lov ushlanadi → avtomatik tasdiq; muddatgacha bekor — ushlangan pul to'liq bo'shaydi", async () => {
    const order = await book(students[0]!);
    if (!order.ok) throw new Error("band qilinmadi");
    expect(order.checkoutUrl).toMatch(/^\/test-tolov\//);
    await pay(order.orderId);
    expect(await statusOf(order.orderId)).toBe("CONFIRMED");
    expect((await paymentOf(order.orderId)).status).toBe("HELD");
    // takroriy callback hech narsani o'zgartirmaydi
    await pay(order.orderId);
    expect(await db.orderEvent.count({ where: { orderId: order.orderId, to: "PAID" } })).toBe(1);

    expect((await cancelOrderByStudent(students[0]!, order.orderId)).ok).toBe(true);
    const payment = await paymentOf(order.orderId);
    expect([payment.status, payment.captured]).toEqual(["CANCELLED", 0]);
  });

  it("kech bekor qilinsa — biznes tanlagan 30% yechiladi, qolgani qaytadi", async () => {
    const order = await book(students[0]!);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    // slotdan 30 daqiqa oldin (bepul muddat — 60 daqiqa) bekor qilish
    const late = new Date(slotAt().getTime() - 30 * 60_000);
    expect((await transitionOrder({ orderId: order.orderId, to: "CANCELLED", actor: "student", actorId: students[0]!, scope: { studentId: students[0]! }, now: late })).ok).toBe(true);
    const payment = await paymentOf(order.orderId);
    expect([payment.status, payment.amount, payment.captured]).toEqual(["CAPTURED", 30_000, 9_000]);
  });

  it("biznes rad etsa — to'liq qaytadi; to'lov rad etilsa — buyurtma bekor, joy bo'shaydi", async () => {
    await setSettings({ autoConfirm: false });
    const a = await book(students[0]!);
    const b = await book(students[1]!);
    if (!a.ok || !b.ok) throw new Error("band qilinmadi");
    await pay(a.orderId);
    expect(await decideOrder(ownerId, a.orderId, "reject", "Bugun tugadi")).toEqual({ ok: true, from: "PAID" });
    expect((await paymentOf(a.orderId)).status).toBe("CANCELLED");
    expect((await db.order.findUniqueOrThrow({ where: { id: a.orderId } })).rejectReason).toBe("Bugun tugadi");

    await pay(b.orderId, "FAILED");
    expect(await statusOf(b.orderId)).toBe("CANCELLED");
    expect((await paymentOf(b.orderId)).status).toBe("FAILED");
    expect(await booked()).toBe(0);
  });
});

describe("avtomatika (cron)", () => {
  it("javobsiz (10 daq) va to'lanmagan (15 daq) buyurtmalar bekor qilinadi, pul qaytadi", async () => {
    await setSettings({ autoConfirm: false });
    const unanswered = await book(students[0]!);
    const unpaid = await book(students[1]!);
    if (!unanswered.ok || !unpaid.ok) throw new Error("band qilinmadi");
    await pay(unanswered.orderId);
    expect(await statusOf(unanswered.orderId)).toBe("PAID");

    // hali vaqt bor — hech narsa o'zgarmaydi
    expect(await runOrderAutomation(new Date(Date.now() + 5 * 60_000), { businessId })).toEqual({ unpaid: 0, unanswered: 0, autoConfirmed: 0, noShow: 0 });
    const result = await runOrderAutomation(new Date(Date.now() + 16 * 60_000), { businessId });
    expect(result).toMatchObject({ unpaid: 1, unanswered: 1 });
    expect(await statusOf(unanswered.orderId)).toBe("CANCELLED");
    expect(await statusOf(unpaid.orderId)).toBe("CANCELLED");
    expect((await paymentOf(unanswered.orderId)).status).toBe("CANCELLED");
    expect(await booked()).toBe(0);
    // idempotent
    expect(await runOrderAutomation(new Date(Date.now() + 16 * 60_000), { businessId })).toEqual({ unpaid: 0, unanswered: 0, autoConfirmed: 0, noShow: 0 });
  });

  it("slot tugab kelmasa — KELMADI, 30% yechiladi", async () => {
    const order = await book(students[0]!);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    const slotEnd = (await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).slotEnd;
    expect((await runOrderAutomation(new Date(slotEnd.getTime() + NO_SHOW_GRACE_MS + 60_000), { businessId })).noShow).toBe(1);
    expect(await statusOf(order.orderId)).toBe("NO_SHOW");
    const payment = await paymentOf(order.orderId);
    expect([payment.status, payment.captured]).toEqual(["CAPTURED", 9_000]);
  });
});

describe("kassir", () => {
  it("QR kodi bilan skan → BERILDI, oldindan to'lov to'liq yechiladi; ikkinchi skan — takror", async () => {
    const order = await book(students[0]!, slotAt(), 2);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    const code = await totpCode(decryptSecret(saved.secret), windowAt(Date.now()));

    const scan = await scanOrder(cashier, { code: saved.code, totp: code });
    if (!scan.ok) throw new Error(`skan: ${scan.result}`);
    expect(scan.order).toMatchObject({ quantity: 2, title: "Itest lag'mon", prepayAmount: 60_000, dueNow: 0 });
    expect(await completeOrderScan(cashier, scan.order.orderId, scan.order.ticket)).toEqual({ ok: true });
    expect(await statusOf(order.orderId)).toBe("COMPLETED");
    expect((await paymentOf(order.orderId)).captured).toBe(60_000);
    expect(await scanOrder(cashier, { code: saved.code, totp: code })).toEqual({ ok: false, result: "REPLAYED" });
  });

  it("tasdiqlanmagan buyurtma berilmaydi; noto'g'ri 6 raqam rad etiladi", async () => {
    await setSettings({ autoConfirm: false });
    const order = await book(students[0]!);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    const code = await totpCode(decryptSecret(saved.secret), windowAt(Date.now()));
    expect(await scanOrder(cashier, { code: saved.code, totp: code })).toEqual({ ok: false, result: "ORDER_NOT_CONFIRMED" });
    expect(await scanOrder(cashier, { code: saved.code, totp: code === "000000" ? "111111" : "000000" })).toEqual({ ok: false, result: "INVALID" });
  });
});

describe("chegirma sahifasidagi tugma (bookingAvailability)", () => {
  it("belgisiz chegirma yoki o'chiq biznes — tugma yo'q (null); ochiq — open", async () => {
    expect(await bookingAvailability(discountId)).toEqual({ open: true });
    await db.discount.update({ where: { id: discountId }, data: { preorder: false } });
    expect(await bookingAvailability(discountId)).toBeNull();
    await db.discount.update({ where: { id: discountId }, data: { preorder: true } });
    await db.preorderSettings.update({ where: { businessId }, data: { enabled: false } });
    expect(await bookingAvailability(discountId)).toBeNull();
  });

  it("chegirma soatlari jadvalga to'g'ri kelmasa — \"hours\" va shu soatdan tashqaridagi slot band qilinmaydi", async () => {
    // JierEdu: chegirma 00:00–04:01, jadval har kuni 14:00–20:00
    await db.discount.update({ where: { id: discountId }, data: { fromMinute: 0, toMinute: 241 } });
    try {
      await setSettings({ schedule: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 840, to: 1200 })) });
      expect(await bookingAvailability(discountId)).toEqual({ open: false, reason: "hours" });
      expect(await book(students[0]!, fromTashkent(tomorrow(), 840))).toEqual({ ok: false, error: "slot" });
      // Jadval chegirma soatlarini qamrasa — ochiladi, lekin faqat 04:01 gacha tugaydigan slotlar
      await setSettings({ schedule: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 0, to: 360 })) });
      expect(await bookingAvailability(discountId)).toEqual({ open: true });
      expect((await book(students[0]!, fromTashkent(tomorrow(), 180))).ok).toBe(true);
      expect(await book(students[1]!, fromTashkent(tomorrow(), 240))).toEqual({ ok: false, error: "slot" });
    } finally {
      await db.discount.update({ where: { id: discountId }, data: { fromMinute: 0, toMinute: 1439 } });
    }
  });

  it("hamma slot to'lgan — \"full\"; bugun to'xtatilgan — \"paused\"", async () => {
    // Faqat ertaga bitta slot (12:00–13:00), sig'imi 1
    const weekday = tomorrow().getUTCDay() === 0 ? 7 : tomorrow().getUTCDay();
    await setSettings({ schedule: [{ day: weekday, from: 720, to: 780 }], slotCapacity: 1 });
    expect(await bookingAvailability(discountId)).toEqual({ open: true });
    expect((await book(students[0]!)).ok).toBe(true);
    expect(await bookingAvailability(discountId)).toEqual({ open: false, reason: "full" });
    await setSettings({ daysAhead: 0, pausedOn: toTashkent(new Date()).date });
    expect(await bookingAvailability(discountId)).toEqual({ open: false, reason: "paused" });
  });
});
