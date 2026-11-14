import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/payments";
import { fromTashkent, toTashkent } from "@/lib/time";
import { totpCode, windowAt } from "@/lib/totp";
import { decryptSecret } from "../coupons/coupons";
import { scannerFor, type Scanner } from "../coupons/scan";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { createOrder, handlePaymentCallback, runOrderAutomation, transitionOrder, NO_SHOW_GRACE_MS } from "./orders";
import { completeOrderScan, scanOrder } from "./scan";
import { bookingAvailability, bookingOffer } from "./settings";
import { cancelOrderByStudent, decideOrder } from "./views";

// Oldindan band qilish: uch rejim (uchrashuv, to'lab olib ketish, oyna), atom sig'im/zaxira, holat mashinasi, pul qoidasi,
// avtomatika (muddat, eslatma), kassir.
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
    schedule: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 0, to: 1440 })),
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

/** Chegirma: standart — vaqtli uchrashuv, 60 daqiqa, 10 mutaxassis (har testdan oldin tiklanadi) */
const setDiscount = (over: Prisma.DiscountUpdateInput = {}) =>
  db.discount.update({
    where: { id: discountId },
    data: {
      bookingMode: "APPOINTMENT",
      serviceMinutes: 60,
      staffCount: 10,
      fromMinute: 0,
      toMinute: 1439,
      newPrice: 30_000,
      stock: 0,
      validDays: 7,
      perStudentMax: 2,
      expireKeepPercent: 0,
      windowFrom: 12 * 60,
      windowTo: 18 * 60,
      windowCapacity: 20,
      ...over,
    },
  });

const book = (student: string, slot: Date | null = slotAt(), quantity = 1) =>
  createOrder(student, { discountId, slotStart: slot?.toISOString(), quantity, phone: "+998901234567" });

/** Soxta provayder orqali to'lov (callback imzosi haqiqiy oqimdagidek) */
async function pay(orderId: string, status: "HELD" | "FAILED" = "HELD") {
  const payment = await db.payment.findUniqueOrThrow({ where: { orderId } });
  const { body, headers } = mockProvider().signedCallback({ providerPaymentId: payment.providerPaymentId!, status, amount: payment.amount });
  return handlePaymentCallback("mock", body, headers);
}

const statusOf = async (orderId: string) => (await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })).status;
const paymentOf = (orderId: string) => db.payment.findUniqueOrThrow({ where: { orderId } });
const booked = async (slot = slotAt()) => (await db.bookingSeat.findUnique({ where: { discountId_startsAt: { discountId, startsAt: slot } } }))?.booked ?? 0;
const stockOf = async () => (await db.discount.findUniqueOrThrow({ where: { id: discountId }, select: { stock: true } })).stock;
const NONE_RAN = { unpaid: 0, unanswered: 0, autoConfirmed: 0, noShow: 0, expired: 0, reminded: 0 };

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
      bookingMode: "APPOINTMENT",
    },
  });
  discountId = discount.id;
});

beforeEach(async () => {
  const ids = (await db.order.findMany({ where: { businessId }, select: { id: true } })).map((o) => o.id);
  await db.auditLog.deleteMany({ where: { entity: "Order", entityId: { in: ids } } });
  await db.order.deleteMany({ where: { businessId } });
  await db.bookingSeat.deleteMany({ where: { discountId } });
  await setSettings();
  await setDiscount();
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
    await setDiscount({ staffCount: 1 });
    expect((await book(students[1]!)).ok).toBe(false);
    expect((await cancelOrderByStudent(students[0]!, first.orderId)).ok).toBe(true);
    // ikkinchi bekor — ruxsat yo'q (yakuniy holat), joy ikki marta qaytmaydi
    expect(await cancelOrderByStudent(students[0]!, first.orderId)).toEqual({ ok: false, error: "forbidden" });
    expect(await booked()).toBe(0);
    expect((await book(students[1]!)).ok).toBe(true);
    expect(await booked()).toBe(1);
  });

  it("o'chiq biznes, rejimsiz chegirma, jadvalda yo'q slot — band qilinmaydi", async () => {
    await db.preorderSettings.update({ where: { businessId }, data: { enabled: false } });
    expect(await book(students[0]!)).toEqual({ ok: false, error: "notAvailable" });
    await setSettings();
    await setDiscount({ bookingMode: "NONE" });
    expect(await book(students[0]!)).toEqual({ ok: false, error: "notAvailable" });
    await setDiscount();
    expect(await book(students[0]!, new Date(slotAt().getTime() + 15 * 60_000))).toEqual({ ok: false, error: "slot" });
    // uchrashuv — bitta joy (soni 1)
    expect(await book(students[0]!, slotAt(), 2)).toEqual({ ok: false, error: "quantity" });
  });
});

describe("APPOINTMENT: davomiylik va mutaxassislar", () => {
  it("xizmat davomiyligi slot uzunligini belgilaydi", async () => {
    const weekday = tomorrow().getUTCDay() === 0 ? 7 : tomorrow().getUTCDay();
    await setSettings({ schedule: [{ day: weekday, from: 720, to: 900 }] });
    await setDiscount({ serviceMinutes: 45 });
    const offer = await bookingOffer(discountId, null);
    const day = offer!.days.find((d) => d.date === tomorrow().toISOString().slice(0, 10))!;
    // 12:00–15:00 oralig'ida 45 daqiqalik slotlar: 12:00, 12:45, 13:30, 14:15 (oxirgisi 15:00 da tugaydi)
    expect(day.slots.map((s) => toTashkent(new Date(s.start)).minute)).toEqual([720, 765, 810, 855]);
    expect(day.slots.every((s) => Date.parse(s.end) - Date.parse(s.start) === 45 * 60_000)).toBe(true);
    expect((await book(students[0]!, fromTashkent(tomorrow(), 765))).ok).toBe(true);
    expect(await book(students[1]!, fromTashkent(tomorrow(), 780))).toEqual({ ok: false, error: "slot" });
    const order = await db.order.findFirstOrThrow({ where: { discountId, studentId: students[0]! } });
    expect(order.slotEnd.getTime() - order.slotStart.getTime()).toBe(45 * 60_000);
    expect(order.kind).toBe("APPOINTMENT");
  });

  it("mutaxassislar soni sig'imni belgilaydi: 3 usta — 6 parallel so'rovdan 3 tasi", async () => {
    await setDiscount({ staffCount: 3 });
    const results = await Promise.all(students.slice(0, 6).map((s) => book(s)));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok && r.error === "slotFull")).toHaveLength(3);
    const slot = (await bookingOffer(discountId, null))!.days.flatMap((d) => d.slots).find((s) => s.start === slotAt().toISOString())!;
    expect([slot.left, slot.disabled]).toEqual([0, true]);
  });
});

describe("PREPAID_PICKUP: zaxira va muddat", () => {
  it("zaxira 5 ta, 12 parallel so'rov — aynan 5 tasi o'tadi; bekor qilinsa zaxira qaytadi", async () => {
    await setDiscount({ bookingMode: "PREPAID_PICKUP", stock: 5 });
    const results = await Promise.all(students.slice(0, 12).map((s) => book(s, null)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok && r.error === "soldOut")).toHaveLength(7);
    expect(await stockOf()).toBe(0);
    expect(await bookingAvailability(discountId, students[19]!)).toEqual({ kind: "PREPAID_PICKUP", open: false, reason: "soldOut" });
    const first = results.find((r) => r.ok)!;
    if (!first.ok) throw new Error("band qilinmadi");
    const owner = (await db.order.findUniqueOrThrow({ where: { id: first.orderId } })).studentId;
    expect((await cancelOrderByStudent(owner, first.orderId)).ok).toBe(true);
    expect(await stockOf()).toBe(1);
  });

  it("bir talabaga chegara: 2 dona olgach yana olib bo'lmaydi", async () => {
    await setDiscount({ bookingMode: "PREPAID_PICKUP", stock: 10, perStudentMax: 2 });
    expect((await book(students[0]!, null, 2)).ok).toBe(true);
    expect(await book(students[0]!, null, 1)).toEqual({ ok: false, error: "limit" });
    expect(await bookingAvailability(discountId, students[0]!)).toEqual({ kind: "PREPAID_PICKUP", open: false, reason: "limit" });
    expect(await book(students[1]!, null, 3)).toEqual({ ok: false, error: "quantity" });
  });

  it("uzoq muddat (30 kun > holdMaxDays) — to'lov darhol yechiladi; muddat o'tsa cron 20% ushlab, qolganini refund qiladi", async () => {
    await setDiscount({ bookingMode: "PREPAID_PICKUP", stock: 3, validDays: 30, expireKeepPercent: 20 });
    const order = await book(students[0]!, null);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    expect(await statusOf(order.orderId)).toBe("CONFIRMED");
    expect(await paymentOf(order.orderId)).toMatchObject({ status: "CAPTURED", captured: 30_000 });
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(saved.kind).toBe("PREPAID_PICKUP");
    expect(saved.slotEnd.getTime() - Date.now()).toBeGreaterThan(29 * DAY_MS);

    expect(await runOrderAutomation(new Date(saved.slotEnd.getTime() - 60_000), { businessId })).toMatchObject({ expired: 0 });
    expect((await runOrderAutomation(new Date(saved.slotEnd.getTime() + 60_000), { businessId })).expired).toBe(1);
    expect(await statusOf(order.orderId)).toBe("EXPIRED");
    expect(await paymentOf(order.orderId)).toMatchObject({ status: "PARTIALLY_REFUNDED", captured: 30_000, refunded: 24_000 });
    expect(await stockOf()).toBe(3);
    // idempotent
    expect(await runOrderAutomation(new Date(saved.slotEnd.getTime() + 60_000), { businessId })).toEqual(NONE_RAN);
  });

  it("qisqa muddat (2 kun) — pul ushlab turiladi; muddat o'tsa to'liq qaytarish qoidasi — hold bo'shaydi", async () => {
    await setDiscount({ bookingMode: "PREPAID_PICKUP", stock: 3, validDays: 2, expireKeepPercent: 0 });
    const order = await book(students[0]!, null);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    expect((await paymentOf(order.orderId)).status).toBe("HELD");
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect((await runOrderAutomation(new Date(saved.slotEnd.getTime() + 60_000), { businessId })).expired).toBe(1);
    expect(await paymentOf(order.orderId)).toMatchObject({ status: "CANCELLED", captured: 0 });
  });

  it("muddat tugashiga 2 va 1 kun qolganda bitta-bittadan eslatma", async () => {
    await setDiscount({ bookingMode: "PREPAID_PICKUP", stock: 3, validDays: 10 });
    const order = await book(students[0]!, null);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    const end = (await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).slotEnd.getTime();
    const since = new Date();
    const reminders = () => db.notification.count({ where: { audienceIds: { has: students[0]! }, title: "Olib ketish muddati tugayapti", createdAt: { gte: since } } });
    expect((await runOrderAutomation(new Date(end - 3 * DAY_MS), { businessId })).reminded).toBe(0);
    expect((await runOrderAutomation(new Date(end - 2 * DAY_MS + 60_000), { businessId })).reminded).toBe(1);
    expect((await runOrderAutomation(new Date(end - 2 * DAY_MS + 120_000), { businessId })).reminded).toBe(0);
    expect((await runOrderAutomation(new Date(end - DAY_MS + 60_000), { businessId })).reminded).toBe(1);
    expect((await runOrderAutomation(new Date(end - 3_600_000), { businessId })).reminded).toBe(0);
    expect(await reminders()).toBe(2);
  });

  it("rejimga xos holatlar: uchrashuvga MUDDATI_TUGADI, to'lab olib ketishga KELMADI — rad", async () => {
    const appointment = await book(students[0]!);
    if (!appointment.ok) throw new Error("band qilinmadi");
    await pay(appointment.orderId);
    expect(await transitionOrder({ orderId: appointment.orderId, to: "EXPIRED", actor: "system", actorId: null })).toEqual({ ok: false, error: "forbidden" });
    await setDiscount({ bookingMode: "PREPAID_PICKUP", stock: 3 });
    const prepaid = await book(students[1]!, null);
    if (!prepaid.ok) throw new Error("band qilinmadi");
    await pay(prepaid.orderId);
    expect(await transitionOrder({ orderId: prepaid.orderId, to: "NO_SHOW", actor: "system", actorId: null })).toEqual({ ok: false, error: "forbidden" });
    expect([await statusOf(appointment.orderId), await statusOf(prepaid.orderId)]).toEqual(["CONFIRMED", "CONFIRMED"]);
  });
});

describe("PICKUP_WINDOW: kunlik oyna", () => {
  it("kunlik son dona bo'yicha atom; oyna tugab kelmasa — KELMADI", async () => {
    await setDiscount({ bookingMode: "PICKUP_WINDOW", windowCapacity: 3 });
    const windowStart = slotAt(); // ertaga 12:00
    expect((await book(students[0]!, windowStart, 2)).ok).toBe(true);
    expect(await book(students[1]!, windowStart, 2)).toEqual({ ok: false, error: "slotFull" });
    const last = await book(students[1]!, windowStart, 1);
    if (!last.ok) throw new Error("band qilinmadi");
    expect(await booked(windowStart)).toBe(3);
    // oyna boshi emas — rad
    expect(await book(students[2]!, new Date(windowStart.getTime() + 60 * 60_000), 1)).toEqual({ ok: false, error: "slot" });

    await pay(last.orderId);
    const saved = await db.order.findUniqueOrThrow({ where: { id: last.orderId } });
    expect([saved.kind, saved.slotEnd.getTime()]).toEqual(["PICKUP_WINDOW", fromTashkent(tomorrow(), 18 * 60).getTime()]);
    expect((await runOrderAutomation(new Date(saved.slotEnd.getTime() + NO_SHOW_GRACE_MS + 60_000), { businessId })).noShow).toBe(1);
    expect(await statusOf(last.orderId)).toBe("NO_SHOW");
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
    await setDiscount({ bookingMode: "PICKUP_WINDOW" });
    const order = await book(students[0]!, slotAt(), 2);
    if (!order.ok) throw new Error("band qilinmadi");
    await db.discount.update({ where: { id: discountId }, data: { newPrice: 35_000 } });
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect([saved.unitFinal, saved.totalFinal, saved.prepayAmount]).toEqual([30_000, 60_000, 60_000]);
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
    expect(await runOrderAutomation(new Date(Date.now() + 5 * 60_000), { businessId })).toEqual(NONE_RAN);
    const result = await runOrderAutomation(new Date(Date.now() + 16 * 60_000), { businessId });
    expect(result).toMatchObject({ unpaid: 1, unanswered: 1 });
    expect(await statusOf(unanswered.orderId)).toBe("CANCELLED");
    expect(await statusOf(unpaid.orderId)).toBe("CANCELLED");
    expect((await paymentOf(unanswered.orderId)).status).toBe("CANCELLED");
    expect(await booked()).toBe(0);
    // idempotent
    expect(await runOrderAutomation(new Date(Date.now() + 16 * 60_000), { businessId })).toEqual(NONE_RAN);
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
  it("QR kodi bilan skan (olib ketish oynasi) → BERILDI, oldindan to'lov to'liq yechiladi; ikkinchi skan — takror", async () => {
    await setDiscount({ bookingMode: "PICKUP_WINDOW" });
    const order = await book(students[0]!, slotAt(), 2);
    if (!order.ok) throw new Error("band qilinmadi");
    await pay(order.orderId);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    const code = await totpCode(decryptSecret(saved.secret), windowAt(Date.now()));

    const scan = await scanOrder(cashier, { code: saved.code, totp: code });
    if (!scan.ok) throw new Error(`skan: ${scan.result}`);
    expect(scan.order).toMatchObject({ quantity: 2, kind: "PICKUP_WINDOW", title: "Itest lag'mon", prepayAmount: 60_000, dueNow: 0, slot: "12:00–18:00", validUntil: null });
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
  it("rejimsiz chegirma yoki o'chiq biznes — tugma yo'q (null); ochiq — open", async () => {
    expect(await bookingAvailability(discountId, null)).toEqual({ kind: "APPOINTMENT", open: true });
    await setDiscount({ bookingMode: "NONE" });
    expect(await bookingAvailability(discountId, null)).toBeNull();
    await setDiscount();
    await db.preorderSettings.update({ where: { businessId }, data: { enabled: false } });
    expect(await bookingAvailability(discountId, null)).toBeNull();
  });

  it("chegirma soatlari jadvalga to'g'ri kelmasa — \"hours\" va shu soatdan tashqaridagi slot band qilinmaydi", async () => {
    // JierEdu: chegirma 00:00–04:01, jadval har kuni 14:00–20:00
    await setDiscount({ fromMinute: 0, toMinute: 241 });
    await setSettings({ schedule: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 840, to: 1200 })) });
    expect(await bookingAvailability(discountId, null)).toEqual({ kind: "APPOINTMENT", open: false, reason: "hours" });
    expect(await book(students[0]!, fromTashkent(tomorrow(), 840))).toEqual({ ok: false, error: "slot" });
    // Jadval chegirma soatlarini qamrasa — ochiladi, lekin faqat 04:01 gacha tugaydigan slotlar
    await setSettings({ schedule: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 0, to: 360 })) });
    expect(await bookingAvailability(discountId, null)).toEqual({ kind: "APPOINTMENT", open: true });
    expect((await book(students[0]!, fromTashkent(tomorrow(), 180))).ok).toBe(true);
    expect(await book(students[1]!, fromTashkent(tomorrow(), 240))).toEqual({ ok: false, error: "slot" });
    // Oyna rejimi: oyna chegirma soatlaridan tashqarida — "hours"
    await setDiscount({ bookingMode: "PICKUP_WINDOW", fromMinute: 0, toMinute: 241 });
    expect(await bookingAvailability(discountId, null)).toEqual({ kind: "PICKUP_WINDOW", open: false, reason: "hours" });
  });

  it("hamma slot to'lgan — \"full\"; bugun to'xtatilgan — \"paused\"", async () => {
    // Faqat ertaga bitta slot (12:00–13:00), sig'imi 1
    const weekday = tomorrow().getUTCDay() === 0 ? 7 : tomorrow().getUTCDay();
    await setSettings({ schedule: [{ day: weekday, from: 720, to: 780 }] });
    await setDiscount({ staffCount: 1 });
    expect(await bookingAvailability(discountId, null)).toEqual({ kind: "APPOINTMENT", open: true });
    expect((await book(students[0]!)).ok).toBe(true);
    expect(await bookingAvailability(discountId, null)).toEqual({ kind: "APPOINTMENT", open: false, reason: "full" });
    await setSettings({ daysAhead: 0, pausedOn: toTashkent(new Date()).date });
    expect(await bookingAvailability(discountId, null)).toEqual({ kind: "APPOINTMENT", open: false, reason: "paused" });
  });
});
