import { describe, expect, it } from "vitest";
import { barHeight, busiestWindow, deltaVs, heatKey, heatLevel, hourRange, niceMax, parsePeriod, pct, pct1, periodRange, quietestWeekday } from "./stats";

describe("parsePeriod", () => {
  it("faqat 1/7/30, aks holda 30", () => {
    expect(parsePeriod("1")).toBe(1);
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("30")).toBe(30);
    expect(parsePeriod("90")).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
    expect(parsePeriod(["7", "1"])).toBe(7);
  });
});

describe("periodRange", () => {
  // 2026-10-13 14:31 Toshkent = 09:31 UTC
  const now = new Date("2026-10-13T09:31:00Z");
  it("bugun: Toshkent kuni chegaralari", () => {
    const r = periodRange(1, now);
    expect(r.from.toISOString()).toBe("2026-10-12T19:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-13T19:00:00.000Z");
    expect(r.prevFrom.toISOString()).toBe("2026-10-11T19:00:00.000Z");
    expect(r.prevTo.toISOString()).toBe(r.from.toISOString());
  });
  it("7 kun: bugun ham hisobda, oldingi davr to'g'ridan-to'g'ri undan oldin", () => {
    const r = periodRange(7, now);
    expect(r.days).toHaveLength(7);
    expect(r.days[0]!.toISOString().slice(0, 10)).toBe("2026-10-07");
    expect(r.days[6]!.toISOString().slice(0, 10)).toBe("2026-10-13");
    expect(r.prevFrom.toISOString()).toBe("2026-09-29T19:00:00.000Z");
    expect(r.prevTo.toISOString()).toBe(r.from.toISOString());
  });
  it("Toshkent yarim tunidan keyingi UTC lahza ertangi kunga tegishli", () => {
    const r = periodRange(1, new Date("2026-10-13T19:30:00Z")); // 14.10 00:30 Toshkent
    expect(r.days[0]!.toISOString().slice(0, 10)).toBe("2026-10-14");
  });
});

describe("heatLevel", () => {
  it("0 faqat bo'sh katakda; eng ko'p — 4", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(3, 10)).toBe(2);
    expect(heatLevel(6, 10)).toBe(3);
    expect(heatLevel(10, 10)).toBe(4);
    expect(heatLevel(5, 0)).toBe(0);
  });
});

describe("hourRange", () => {
  it("odatda 08–22, tashqaridagi sotuv bo'lsa kengayadi", () => {
    expect(hourRange([])).toHaveLength(15);
    expect(hourRange([13])[0]).toBe(8);
    expect(hourRange([6, 23])).toEqual(Array.from({ length: 18 }, (_, i) => 6 + i));
  });
});

describe("foizlar va farq", () => {
  it("pct / pct1", () => {
    expect(pct(1284, 2106)).toBe(61);
    expect(pct(5, 0)).toBe(0);
    expect(pct1(2106, 18420)).toBe("11.4");
  });
  it("deltaVs", () => {
    expect(deltaVs(1, 52, 43)).toEqual({ kind: "abs", value: 9 });
    expect(deltaVs(30, 118, 100)).toEqual({ kind: "pct", value: 18 });
    expect(deltaVs(7, 50, 100)).toEqual({ kind: "pct", value: -50 });
    expect(deltaVs(30, 10, 0)).toBeNull();
  });
});

describe("issiqlik xulosasi", () => {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15];
  const grid = new Map<string, number>();
  for (const h of [12, 13, 14]) grid.set(heatKey(4, h), 10); // juma 12–15
  grid.set(heatKey(0, 9), 3);
  grid.set(heatKey(6, 9), 1);
  it("eng gavjum oyna", () => {
    expect(busiestWindow(grid, hours)).toEqual({ weekday: 4, from: 12, to: 15, count: 30 });
  });
  it("eng bo'sh kun — jami eng kam (birinchi nol — seshanba)", () => {
    expect(quietestWeekday(grid)).toBe(1); // dushanba 3, seshanba 0 → indexOf(min) = seshanba
  });
  it("ma'lumot yo'q", () => {
    expect(busiestWindow(new Map(), hours)).toBeNull();
    expect(quietestWeekday(new Map())).toBeNull();
  });
});

describe("grafik o'qi", () => {
  it("niceMax", () => {
    expect(niceMax(0)).toBe(2);
    expect(niceMax(3)).toBe(4);
    expect(niceMax(10)).toBe(10);
    expect(niceMax(52)).toBe(60);
    expect(niceMax(101)).toBe(150);
  });
  it("barHeight", () => {
    expect(barHeight(0, 60)).toBe(2);
    expect(barHeight(1, 1000)).toBe(3);
    expect(barHeight(30, 60)).toBe(50);
  });
});
