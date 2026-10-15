import { describe, expect, it } from "vitest";
import { axisTicks, barPercent, categoryShares, dayBounds, lastDays, linePoints, niceAxis, periodStart, weekOverWeek } from "./admin-stats";

describe("niceAxis", () => {
  it("yumaloq yuqori qiymat", () => {
    expect(niceAxis(3906)).toBe(4000);
    expect(niceAxis(3000)).toBe(4000);
    expect(niceAxis(2000)).toBe(2000);
    expect(niceAxis(2400)).toBe(2500);
    expect(niceAxis(87)).toBe(100);
    expect(niceAxis(0)).toBe(4);
    expect(niceAxis(3)).toBe(4);
  });
  it("hech qachon maksimumdan kichik emas", () => {
    for (const max of [1, 5, 9, 11, 49, 51, 99, 101, 999, 1001, 4001, 24_318]) expect(niceAxis(max)).toBeGreaterThanOrEqual(max);
  });
  it("o'q yozuvlari", () => {
    expect(axisTicks(4000)).toEqual([4000, 2000, 0]);
  });
});

describe("weekOverWeek", () => {
  it("o'sish va pasayish", () => {
    expect(weekOverWeek(111, 100)).toBe(11);
    expect(weekOverWeek(50, 100)).toBe(-50);
    expect(weekOverWeek(100, 100)).toBe(0);
  });
  it("o'tgan hafta bo'sh bo'lsa ko'rsatilmaydi", () => {
    expect(weekOverWeek(10, 0)).toBeNull();
  });
});

describe("categoryShares", () => {
  const sum = (rows: { percent: number }[]) => rows.reduce((s, r) => s + r.percent, 0);
  it("yig'indi aniq 100, kattasi birinchi", () => {
    const rows = categoryShares([
      { key: "food", count: 1 },
      { key: "coffee", count: 1 },
      { key: "books", count: 1 },
    ]);
    expect(sum(rows)).toBe(100);
    expect(rows.map((r) => r.percent).sort()).toEqual([33, 33, 34]);
  });
  it("top'dan keyingilar 'other' ga qo'shiladi", () => {
    const rows = categoryShares(
      [
        { key: "a", count: 40 },
        { key: "b", count: 30 },
        { key: "c", count: 10 },
        { key: "d", count: 8 },
        { key: "e", count: 6 },
        { key: "f", count: 4 },
        { key: "g", count: 2 },
      ],
      5,
    );
    expect(rows.map((r) => r.key)).toEqual(["a", "b", "c", "d", "e", "other"]);
    expect(rows.at(-1)!.count).toBe(6);
    expect(sum(rows)).toBe(100);
  });
  it("sotuv yo'q — bo'sh; nol sonli kategoriya chiqmaydi", () => {
    expect(categoryShares([])).toEqual([]);
    expect(categoryShares([{ key: "a", count: 0 }])).toEqual([]);
    expect(categoryShares([{ key: "a", count: 5 }, { key: "b", count: 0 }])).toEqual([{ key: "a", count: 5, percent: 100 }]);
  });
  it("teng sonlarda tartib barqaror (kalit bo'yicha)", () => {
    expect(categoryShares([{ key: "b", count: 1 }, { key: "a", count: 1 }]).map((r) => r.key)).toEqual(["a", "b"]);
  });
});

describe("grafik", () => {
  it("ustun balandligi", () => {
    expect(barPercent(2000, 4000)).toBe(50);
    expect(barPercent(0, 4000)).toBe(0);
    expect(barPercent(9000, 4000)).toBe(100);
    expect(barPercent(5, 0)).toBe(0);
  });
  it("chiziq: yangi talabalar ×10 sotuv o'qida, har kun markazida", () => {
    // 2 kun, o'q 1000: 50 yangi → 500 → balandlik 50%
    expect(linePoints([50, 0], 1000)).toBe("75.0,50.0 225.0,100.0");
  });
});

describe("kunlar", () => {
  const now = new Date("2026-10-13T09:31:00Z"); // 14:31 Toshkent
  it("lastDays: oxirgisi bugun (Toshkent)", () => {
    const days = lastDays(30, now);
    expect(days).toHaveLength(30);
    expect(days[29]!.toISOString().slice(0, 10)).toBe("2026-10-13");
    expect(days[0]!.toISOString().slice(0, 10)).toBe("2026-09-14");
  });
  it("Toshkent kuni UTC 19:00 da boshlanadi", () => {
    const { from, to } = dayBounds(lastDays(1, now)[0]!);
    expect(from.toISOString()).toBe("2026-10-12T19:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-13T19:00:00.000Z");
  });
  it("Toshkent yarim tunidan keyingi lahza (UTC 19:30) ertangi kunga tushadi", () => {
    const late = new Date("2026-10-13T19:30:00Z");
    expect(lastDays(1, late)[0]!.toISOString().slice(0, 10)).toBe("2026-10-14");
  });
});

describe("periodStart", () => {
  const now = new Date("2026-10-13T09:31:00Z");
  it("bugun — Toshkent kuni boshi", () => expect(periodStart("1", now)!.toISOString()).toBe("2026-10-12T19:00:00.000Z"));
  it("7 kun — bugun ham hisobda", () => expect(periodStart("7", now)!.toISOString()).toBe("2026-10-06T19:00:00.000Z"));
  it("hammasi — cheklovsiz", () => expect(periodStart("all", now)).toBeNull());
});
