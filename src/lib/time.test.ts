import { describe, expect, it } from "vitest";
import { formatMinute, fromTashkent, isOpenAt, parseMinute, toTashkent, type Schedule } from "./time";

const utc = (iso: string) => new Date(iso);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("toTashkent", () => {
  it("UTC+5 ga o'tkazadi", () => {
    // 13.10.2026 seshanba, 14:31 Toshkent = 09:31 UTC
    const t = toTashkent(utc("2026-10-13T09:31:00Z"));
    expect(t.date).toEqual(day("2026-10-13"));
    expect(t.weekday).toBe(2);
    expect(t.minute).toBe(14 * 60 + 31);
  });

  it("UTC kechqurun — Toshkentda keyingi kun", () => {
    const t = toTashkent(utc("2026-10-13T20:30:00Z"));
    expect(t.date).toEqual(day("2026-10-14"));
    expect(t.weekday).toBe(3);
    expect(t.minute).toBe(90);
  });

  it("yakshanba 7 bo'ladi", () => {
    expect(toTashkent(utc("2026-10-18T07:00:00Z")).weekday).toBe(7);
  });

  it("fromTashkent teskari amal", () => {
    const instant = utc("2026-10-13T09:31:00Z");
    const t = toTashkent(instant);
    expect(fromTashkent(t.date, t.minute)).toEqual(instant);
  });
});

describe("daqiqa formati", () => {
  it("ikki tomonga", () => {
    expect(formatMinute(720)).toBe("12:00");
    expect(formatMinute(8 * 60 + 5)).toBe("08:05");
    expect(parseMinute("15:00")).toBe(900);
    expect(parseMinute("24:00")).toBe(1440);
    expect(parseMinute("24:30")).toBeNull();
    expect(parseMinute("9:75")).toBeNull();
    expect(parseMinute("tush")).toBeNull();
  });
});

describe("isOpenAt", () => {
  // Du–Ju 12:00–15:00, 13–31 oktabr (dizayndagi Bodom Choyxonasi chegirmasi)
  const schedule: Schedule = {
    weekdays: [1, 2, 3, 4, 5],
    fromMinute: 720,
    toMinute: 900,
    startsOn: day("2026-10-13"),
    endsOn: day("2026-10-31"),
  };
  const tashkent = (date: string, hhmm: string) => fromTashkent(day(date), parseMinute(hhmm)!);

  it("oyna ichida ochiq", () => {
    expect(isOpenAt(schedule, tashkent("2026-10-13", "14:31"))).toBe(true);
    expect(isOpenAt(schedule, tashkent("2026-10-13", "12:00"))).toBe(true);
  });

  it("tugash daqiqasi kirmaydi", () => {
    expect(isOpenAt(schedule, tashkent("2026-10-13", "14:59"))).toBe(true);
    expect(isOpenAt(schedule, tashkent("2026-10-13", "15:00"))).toBe(false);
    expect(isOpenAt(schedule, tashkent("2026-10-13", "11:59"))).toBe(false);
  });

  it("dam olish kuni yopiq", () => {
    expect(isOpenAt(schedule, tashkent("2026-10-17", "13:00"))).toBe(false);
  });

  it("muddatdan tashqarida yopiq", () => {
    expect(isOpenAt(schedule, tashkent("2026-10-12", "13:00"))).toBe(false);
    expect(isOpenAt(schedule, tashkent("2026-11-02", "13:00"))).toBe(false);
    expect(isOpenAt(schedule, tashkent("2026-10-30", "13:00"))).toBe(true);
  });
});
