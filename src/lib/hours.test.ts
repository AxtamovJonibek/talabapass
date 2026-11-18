import { describe, expect, it } from "vitest";
import {
  ALL_DAY,
  dayPresetOf,
  daysText,
  formatSchedule,
  hoursFor,
  outsideHours,
  parseSchedule,
  scheduleOf,
  timeOptions,
  timePresetOf,
  uniformHours,
  type HoursLabels,
} from "./hours";
import { validateDiscount } from "./discount";

const SHORT = ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const L: HoursLabels = { short: (d) => SHORT[d]!, everyDay: "Har kuni" };

describe("kunlar", () => {
  it("tayyor tanlovlar taniladi", () => {
    expect(dayPresetOf([7, 6])).toBe("weekend");
    expect(dayPresetOf([1, 2, 3, 4, 5])).toBe("workdays");
    expect(dayPresetOf([1, 2, 3, 4, 5, 6, 7])).toBe("everyDay");
    expect(dayPresetOf([1, 3])).toBeNull();
  });

  it("qisqa matn: ketma-ket 3+ kun — chiziqcha bilan", () => {
    expect(daysText([1, 2, 3, 4, 5], L)).toBe("Du–Ju");
    expect(daysText([1, 3], L)).toBe("Du, Ch");
    expect(daysText([1, 2, 3, 5], L)).toBe("Du–Ch, Ju");
    expect(daysText([1, 2], L)).toBe("Du, Se");
    expect(daysText([1, 2, 3, 4, 5, 6, 7], L)).toBe("Har kuni");
  });
});

describe("vaqt ro'yxati", () => {
  it("30 daqiqa qadam; 'gacha' oxirida 23:59; joriy qiymat qo'shiladi", () => {
    const from = timeOptions("from");
    expect(from).toHaveLength(48);
    expect(from[1]).toBe(30);
    expect(timeOptions("to").at(-1)).toBe(1439);
    expect(timeOptions("from", 615)).toContain(615);
  });

  it("tayyor oraliqlar validateDiscount dan o'tadi (Kun bo'yi — 00:00–23:59)", () => {
    expect(timePresetOf({ from: 480, to: 720 })).toBe("morning");
    expect(timePresetOf(ALL_DAY)).toBe("allDay");
    const draft = { title: "Osh", type: "PERCENT" as const, originalPrice: 30000, percent: 20, newPrice: null, weekdays: [1], dailyLimit: 10, startsOn: "2099-01-01", endsOn: "2099-02-01", terms: "", perStudentLimit: "DAILY" as const };
    for (const r of [{ from: 480, to: 720 }, { from: 720, to: 900 }, { from: 1080, to: 1320 }, ALL_DAY, { from: 1320, to: 120 }]) {
      expect(validateDiscount({ ...draft, fromMinute: r.from, toMinute: r.to } as never, "2026-11-18").time).toBeUndefined();
    }
  });
});

describe("jadval matni", () => {
  it("scheduleOf: oraliqdagi ortiqcha 'day' kunni buzmaydi", () => {
    const withDay = { day: 1, from: 480, to: 1320 };
    expect(scheduleOf([1, 2, 3], withDay).map((h) => h.day)).toEqual([1, 2, 3]);
  });

  it("har kuni bir xil", () => {
    const s = scheduleOf([1, 2, 3, 4, 5, 6, 7], { from: 540, to: 1260 });
    expect(formatSchedule(s, L)).toBe("Har kuni · 09:00–21:00");
    expect(uniformHours(s)).toBe(true);
  });

  it("kunlar bo'yicha, dam olish kuni yozilmaydi; yarim tundan o'tish", () => {
    const s = [...scheduleOf([1, 2, 3, 4, 5], { from: 540, to: 1080 }), { day: 6, from: 1320, to: 120 }];
    expect(formatSchedule(s, L)).toBe("Du–Ju 09:00–18:00; Sh 22:00–02:00");
    expect(uniformHours(s)).toBe(false);
  });

  it("formatSchedule ↔ parseSchedule teskari", () => {
    const cases = [
      scheduleOf([1, 2, 3, 4, 5, 6, 7], { from: 540, to: 1260 }),
      [...scheduleOf([1, 3, 5], { from: 600, to: 1200 }), { day: 6, from: 660, to: 900 }],
      [{ day: 7, from: 1320, to: 120 }],
    ];
    for (const s of cases) expect(parseSchedule(formatSchedule(s, L), L)).toEqual(s);
  });

  it("eski erkin matn: faqat oraliq — har kuni; tanilmagani — null", () => {
    expect(parseSchedule("09:00 – 22:00", L)).toEqual(scheduleOf([1, 2, 3, 4, 5, 6, 7], { from: 540, to: 1320 }));
    expect(parseSchedule("9.00-18.00", L)).toHaveLength(7);
    expect(parseSchedule("har kuni 24 soat", L)).toBeNull();
    expect(parseSchedule("", L)).toBeNull();
  });
});

describe("chegirma ish vaqtidan chiqadimi", () => {
  const hours = [...scheduleOf([1, 2, 3, 4, 5], { from: 540, to: 1080 }), { day: 6, from: 1200, to: 120 }];

  it("ichida — bo'sh; tashqarida yoki dam olish kuni — o'sha kunlar", () => {
    expect(outsideHours([1, 2], { from: 600, to: 720 }, hours)).toEqual([]);
    expect(outsideHours([1, 2], { from: 1020, to: 1140 }, hours)).toEqual([1, 2]);
    expect(outsideHours([7], { from: 600, to: 720 }, hours)).toEqual([7]);
  });

  it("yarim tundan o'tadigan ish vaqti va chegirma", () => {
    // Shanba 20:00–02:00 ochiq: shanba 23:00–01:00 ichida
    expect(outsideHours([6], { from: 1380, to: 60 }, hours)).toEqual([]);
    // Shanba 23:00–03:00 — yakshanba 02:00 dan keyin yopiq
    expect(outsideHours([6], { from: 1380, to: 180 }, hours)).toEqual([6]);
  });

  it("jadval noma'lum — tekshirilmaydi; 'Ish vaqti bo'yicha'", () => {
    expect(outsideHours([1], { from: 0, to: 60 }, [])).toEqual([]);
    expect(hoursFor([6, 7], hours)).toEqual({ from: 1200, to: 120 });
    expect(hoursFor([], hours)).toEqual({ from: 540, to: 1080 });
    expect(hoursFor([1], [])).toBeNull();
  });
});
