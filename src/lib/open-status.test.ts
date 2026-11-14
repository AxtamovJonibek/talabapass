import { describe, expect, it } from "vitest";
import { statusFromTiming } from "./open-status";
import { dealTiming, fromTashkent, toTashkent, type Schedule } from "./time";

// 2026-11-13 — juma (5). Vaqtlar Toshkent bo'yicha.
const FRIDAY = toTashkent(new Date("2026-11-13T07:00:00Z")).date;
const DAY = 86_400_000;
const at = (minute: number, dayOffset = 0) => fromTashkent(new Date(FRIDAY.getTime() + dayOffset * DAY), minute);
const schedule = (over: Partial<Schedule> = {}): Schedule => ({
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  fromMinute: 9 * 60,
  toMinute: 23 * 60,
  startsOn: new Date(FRIDAY.getTime() - 30 * DAY),
  endsOn: new Date(FRIDAY.getTime() + 30 * DAY),
  ...over,
});
const status = (s: Schedule, now: Date) => statusFromTiming(dealTiming(s, now), now);
const clock = (d: Date) => toTashkent(d).minute;

describe("holat pilyulkasi", () => {
  it("ochiq: yopilish vaqti bilan", () => {
    const s = status(schedule(), at(12 * 60));
    expect(s.kind).toBe("open");
    if (s.kind === "open") expect(clock(s.closesAt)).toBe(23 * 60);
  });

  it("yarim tundan o'tadigan ish vaqti (22:00–02:00): 01:00 da ochiq, 02:00 gacha; 03:00 da — bugun 22:00 da", () => {
    const night = schedule({ fromMinute: 22 * 60, toMinute: 2 * 60 });
    const open = status(night, at(60));
    expect(open.kind).toBe("open");
    if (open.kind === "open") expect([clock(open.closesAt), toTashkent(open.closesAt).date.getTime()]).toEqual([120, FRIDAY.getTime()]);
    const later = status(night, at(3 * 60));
    expect(later.kind).toBe("today");
    if (later.kind === "today") expect(clock(later.opensAt)).toBe(22 * 60);
  });

  it("60 daqiqadan kam qolsa — daqiqalar bilan", () => {
    expect(status(schedule({ fromMinute: 16 * 60 }), at(15 * 60 + 15))).toMatchObject({ kind: "soon", minutes: 45 });
    // aynan 60 daqiqa — "bugun 16:00 da"
    expect(status(schedule({ fromMinute: 16 * 60 }), at(15 * 60)).kind).toBe("today");
  });

  it("bugun keyinroq ochiladi", () => {
    const s = status(schedule({ fromMinute: 16 * 60 }), at(8 * 60));
    expect(s.kind).toBe("today");
    if (s.kind === "today") expect(clock(s.opensAt)).toBe(16 * 60);
  });

  it("bugun yopilgan — ertaga 09:00 da", () => {
    const s = status(schedule(), at(23 * 60 + 30));
    expect(s).toMatchObject({ kind: "closed", inDays: 1, weekday: 6 });
    if (s.kind === "closed") expect(clock(s.opensAt)).toBe(9 * 60);
  });

  it("bugun umuman ishlamaydi (faqat dushanba) — dushanba 09:00 da", () => {
    const s = status(schedule({ weekdays: [1] }), at(10 * 60));
    expect(s).toMatchObject({ kind: "closed", inDays: 3, weekday: 1 });
  });

  it("yarim tundan keyin, ertangi kun ochilishi 60 daqiqadan kam — daqiqalar", () => {
    // 23:30, ertaga 00:15 da ochiladi → 45 daqiqa
    expect(status(schedule({ fromMinute: 15, toMinute: 120 }), at(23 * 60 + 30))).toMatchObject({ kind: "soon", minutes: 45 });
  });

  it("muddat tugagan — ended", () => {
    expect(status(schedule({ endsOn: new Date(FRIDAY.getTime() - DAY) }), at(12 * 60))).toEqual({ kind: "ended" });
  });
});
