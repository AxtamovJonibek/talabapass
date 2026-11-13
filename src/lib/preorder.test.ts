import { describe, expect, it } from "vitest";
import {
  allowedFrom,
  bookingBlock,
  bookingDays,
  canTransition,
  discountSlots,
  findSlot,
  FINAL_STATUSES,
  freeCancelUntil,
  noShowSettlement,
  ORDER_STATUSES,
  orderAmounts,
  preorderSettingsInput,
  settlement,
  slotInDiscount,
  slotsOn,
  DEFAULT_SETTINGS,
  type BookingConfig,
  type OrderActor,
} from "./preorder";
import { fromTashkent, toTashkent, type Schedule } from "./time";

// 2026-11-13 (juma) 12:00 Toshkent
const NOW = new Date("2026-11-13T07:00:00Z");
const TODAY = toTashkent(NOW).date;
const DAY = 86_400_000;
const config = (over: Partial<BookingConfig> = {}): BookingConfig => ({
  schedule: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 14 * 60, to: 16 * 60 })),
  slotMinutes: 30,
  leadMinutes: 30,
  daysAhead: 1,
  pausedOn: null,
  ...over,
});

describe("holat mashinasi", () => {
  it("ruxsat etilgan o'tishlar", () => {
    expect(canTransition("system", "PENDING_PAYMENT", "PAID")).toBe(true);
    expect(canTransition("business", "PAID", "CONFIRMED")).toBe(true);
    expect(canTransition("business", "CONFIRMED", "READY")).toBe(true);
    expect(canTransition("cashier", "READY", "COMPLETED")).toBe(true);
    expect(canTransition("cashier", "CONFIRMED", "COMPLETED")).toBe(true);
    expect(canTransition("student", "READY", "CANCELLED")).toBe(true);
    expect(canTransition("system", "READY", "NO_SHOW")).toBe(true);
  });

  it("ruxsat etilmaganlari rad etiladi", () => {
    // to'lanmagan buyurtmani biznes tasdiqlay olmaydi, kassir bera olmaydi
    expect(canTransition("business", "PENDING_PAYMENT", "CONFIRMED")).toBe(false);
    expect(canTransition("cashier", "PAID", "COMPLETED")).toBe(false);
    // talaba o'zi "to'landi" yoki "berildi" qila olmaydi
    expect(canTransition("student", "PENDING_PAYMENT", "PAID")).toBe(false);
    expect(canTransition("student", "READY", "COMPLETED")).toBe(false);
    // orqaga qaytish yo'q
    expect(canTransition("business", "READY", "CONFIRMED")).toBe(false);
    expect(canTransition("system", "COMPLETED", "NO_SHOW")).toBe(false);
  });

  it("yakuniy holatlardan hech qayerga o'tilmaydi", () => {
    const actors: OrderActor[] = ["student", "business", "cashier", "system"];
    for (const from of FINAL_STATUSES) {
      for (const actor of actors) for (const to of ORDER_STATUSES) expect(canTransition(actor, from, to), `${actor}: ${from}→${to}`).toBe(false);
    }
  });

  it("jadvalda yo'q yo'nalish — bo'sh ro'yxat", () => {
    expect(allowedFrom("student", "CONFIRMED")).toEqual([]);
  });
});

describe("slotlar", () => {
  it("oraliq ichida, oxirgisi oraliq oxirida tugaydi", () => {
    const slots = slotsOn(config(), TODAY, NOW);
    expect(slots.map((s) => toTashkent(s.start).minute)).toEqual([840, 870, 900, 930]);
    expect(slots.every((s) => !s.late)).toBe(true);
    expect(slots.at(-1)!.end.getTime()).toBe(fromTashkent(TODAY, 960).getTime());
  });

  it("o'tgan va tayyorlashga vaqt yetmaydigan slot o'chiq", () => {
    const at1420 = fromTashkent(TODAY, 14 * 60 + 20);
    const late = slotsOn(config(), TODAY, at1420).map((s) => s.late);
    // 14:00 o'tgan, 14:30 — 30 daqiqalik tayyorlashga 10 daqiqa yetmaydi, 15:00 dan ochiq
    expect(late).toEqual([true, true, false, false]);
  });

  it("kunlar: bugun+ertaga, jadvalda yo'q kun va to'xtatilgan bugun chiqmaydi", () => {
    expect(bookingDays(config(), NOW).map((d) => d.getTime())).toEqual([TODAY.getTime(), TODAY.getTime() + DAY]);
    expect(bookingDays(config({ daysAhead: 0 }), NOW)).toHaveLength(1);
    expect(bookingDays(config({ pausedOn: TODAY }), NOW).map((d) => d.getTime())).toEqual([TODAY.getTime() + DAY]);
    // shanba (6) yopiq — ertaga band qilib bo'lmaydi
    const noSaturday = config({ schedule: config().schedule.filter((d) => d.day !== 6) });
    expect(bookingDays(noSaturday, NOW)).toHaveLength(1);
  });

  it("server tekshiruvi: jadvaldagi va ochiq slotgina topiladi", () => {
    expect(findSlot(config(), fromTashkent(TODAY, 900), NOW)).not.toBeNull();
    expect(findSlot(config(), fromTashkent(TODAY, 905), NOW)).toBeNull();
    expect(findSlot(config(), fromTashkent(new Date(TODAY.getTime() + 2 * DAY), 900), NOW)).toBeNull();
    expect(findSlot(config(), fromTashkent(TODAY, 900), fromTashkent(TODAY, 880))).toBeNull();
  });
});

describe("narx", () => {
  const unit = { original: 38_000, final: 26_600 };
  it("to'liq, qisman (yuqoriga yaxlitlanadi), to'lovsiz", () => {
    expect(orderAmounts(unit, 3, { type: "FULL", percent: 50 })).toEqual({ totalOriginal: 114_000, totalDiscount: 34_200, totalFinal: 79_800, prepayAmount: 79_800 });
    expect(orderAmounts(unit, 1, { type: "PARTIAL", percent: 33 }).prepayAmount).toBe(8778);
    expect(orderAmounts(unit, 2, { type: "NONE", percent: 50 }).prepayAmount).toBe(0);
  });
});

describe("bekor qilish qoidasi", () => {
  const slotStart = fromTashkent(TODAY, 18 * 60);
  const order = { status: "CONFIRMED" as const, prepayAmount: 50_000, freeCancelMinutes: 60, keepPercent: 30, slotStart };

  it("bepul muddatgacha — hammasi qaytadi (chegarada ham)", () => {
    expect(freeCancelUntil(order).getTime()).toBe(fromTashkent(TODAY, 17 * 60).getTime());
    expect(settlement(order, "student", fromTashkent(TODAY, 16 * 60))).toEqual({ keep: 0, refund: 50_000 });
    expect(settlement(order, "student", fromTashkent(TODAY, 17 * 60))).toEqual({ keep: 0, refund: 50_000 });
  });

  it("kech — biznes tanlagan % qoladi", () => {
    expect(settlement(order, "student", fromTashkent(TODAY, 17 * 60 + 1))).toEqual({ keep: 15_000, refund: 35_000 });
    expect(settlement({ ...order, keepPercent: 100 }, "student", slotStart)).toEqual({ keep: 50_000, refund: 0 });
    expect(settlement({ ...order, keepPercent: 0 }, "student", slotStart)).toEqual({ keep: 0, refund: 50_000 });
  });

  it("biznes rad etsa yoki tizim bekor qilsa — muddatdan qat'i nazar to'liq qaytadi", () => {
    expect(settlement(order, "business", slotStart)).toEqual({ keep: 0, refund: 50_000 });
    expect(settlement({ ...order, status: "PAID" }, "system", slotStart)).toEqual({ keep: 0, refund: 50_000 });
  });

  it("to'lanmagan yoki to'lovsiz bronda pul yo'q", () => {
    expect(settlement({ ...order, status: "PENDING_PAYMENT" }, "student", slotStart)).toEqual({ keep: 0, refund: 0 });
    expect(settlement({ ...order, prepayAmount: 0 }, "student", slotStart)).toEqual({ keep: 0, refund: 0 });
  });

  it("kelmadi — % qoladi, qolgani qaytadi", () => {
    expect(noShowSettlement(order)).toEqual({ keep: 15_000, refund: 35_000 });
    expect(noShowSettlement({ ...order, prepayAmount: 33_333, keepPercent: 50 })).toEqual({ keep: 16_667, refund: 16_666 });
  });
});

describe("sozlamalar sxemasi", () => {
  it("standart qiymatlar to'g'ri; noto'g'ri qiymatlar rad etiladi", () => {
    expect(preorderSettingsInput.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(preorderSettingsInput.safeParse({ ...DEFAULT_SETTINGS, slotMinutes: 20 }).success).toBe(false);
    expect(preorderSettingsInput.safeParse({ ...DEFAULT_SETTINGS, keepPercent: 101 }).success).toBe(false);
    expect(preorderSettingsInput.safeParse({ ...DEFAULT_SETTINGS, schedule: [{ day: 1, from: 900, to: 840 }] }).success).toBe(false);
    expect(preorderSettingsInput.safeParse({ ...DEFAULT_SETTINGS, schedule: [{ day: 1, from: 840, to: 900 }, { day: 1, from: 960, to: 1000 }] }).success).toBe(false);
  });
});

describe("chegirma soatlari bilan kesishuv va tugma sababi", () => {
  const discount = (over: Partial<Schedule> = {}): Schedule => ({
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    fromMinute: 0,
    toMinute: 1439,
    startsOn: new Date(TODAY.getTime() - DAY),
    endsOn: new Date(TODAY.getTime() + 10 * DAY),
    ...over,
  });
  const slot = (from: number, to: number, date = TODAY) => ({ start: fromTashkent(date, from), end: fromTashkent(date, to) });
  const free = () => 10;

  it("slot butunlay chegirma oralig'i ichida bo'lishi kerak (yarim tundan o'tadigan ham)", () => {
    const night = discount({ fromMinute: 0, toMinute: 241 }); // 00:00–04:01
    expect(slotInDiscount(night, slot(225, 240))).toBe(true); // 03:45–04:00
    expect(slotInDiscount(night, slot(240, 255))).toBe(false); // 04:00–04:15 — 04:01 da yopiladi
    expect(slotInDiscount(night, slot(840, 870))).toBe(false); // 14:00 — umuman tashqarida
    const late = discount({ fromMinute: 22 * 60, toMinute: 2 * 60 }); // 22:00–02:00
    expect(slotInDiscount(late, slot(23 * 60, 24 * 60))).toBe(true);
    expect(slotInDiscount(late, slot(60, 120, new Date(TODAY.getTime() + DAY)))).toBe(true); // ertasi 01:00 — kechagi oraliq
    expect(slotInDiscount(discount({ weekdays: [1] }), slot(840, 870))).toBe(false); // juma — chegirma kuni emas
    expect(slotInDiscount(discount({ endsOn: new Date(TODAY.getTime() - DAY) }), slot(840, 870))).toBe(false);
  });

  it("JierEdu holati: chegirma 00:00–04:01, jadval 14:00–16:00 — slot yo'q, sababi \"hours\"", () => {
    const night = discount({ fromMinute: 0, toMinute: 241 });
    expect(discountSlots(config(), night, NOW)).toEqual([]);
    expect(bookingBlock(config(), night, NOW, free)).toBe("hours");
  });

  it("ochiq slot bor — null; hammasi to'lgan yoki o'tgan — full", () => {
    expect(bookingBlock(config(), discount(), NOW, free)).toBeNull();
    expect(bookingBlock(config(), discount(), NOW, () => 0)).toBe("full");
    // bugun 17:00, ertaga ham yo'q (daysAhead 0) — bugungi slotlar o'tgan
    expect(bookingBlock(config({ daysAhead: 0 }), discount(), fromTashkent(TODAY, 17 * 60), free)).toBe("full");
    // ertangi slotlar to'lgan, bugungilari bo'sh — ochiq
    const tomorrowFull = (start: Date) => (start.getTime() >= TODAY.getTime() + DAY ? 0 : 1);
    expect(bookingBlock(config(), discount(), NOW, tomorrowFull)).toBeNull();
  });

  it("bugun to'xtatilgan — paused; jadvalda kun yo'q — closed", () => {
    expect(bookingBlock(config({ daysAhead: 0, pausedOn: TODAY }), discount(), NOW, free)).toBe("paused");
    // ertaga ochiq bo'lsa — to'xtatilgan bugun to'sqinlik qilmaydi
    expect(bookingBlock(config({ pausedOn: TODAY }), discount(), NOW, free)).toBeNull();
    expect(bookingBlock(config({ schedule: [{ day: 1, from: 840, to: 960 }] }), discount(), NOW, free)).toBe("closed");
  });
});
