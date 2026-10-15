import { describe, expect, it } from "vitest";
import { dealTiming, formatMinute, fromTashkent, isOpenAt, nextWindowStart, openWindowStart, parseMinute, toTashkent, windowEnd, type Schedule } from "./time";

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

describe("yarim tundan o'tadigan oraliq (22:00–02:00)", () => {
  // Faqat dushanba kuni boshlanadi, 13–31 oktabr. 12.10.2026 — dushanba, 13.10 — seshanba.
  const night: Schedule = {
    weekdays: [1],
    fromMinute: 22 * 60,
    toMinute: 2 * 60,
    startsOn: day("2026-10-12"),
    endsOn: day("2026-10-19"),
  };
  const at = (date: string, hhmm: string) => fromTashkent(day(date), parseMinute(hhmm)!);

  it("dushanba 22:00–23:59 ochiq", () => {
    expect(isOpenAt(night, at("2026-10-12", "22:00"))).toBe(true);
    expect(isOpenAt(night, at("2026-10-12", "23:59"))).toBe(true);
    expect(isOpenAt(night, at("2026-10-12", "21:59"))).toBe(false);
  });

  it("seshanba 00:00–01:59 ham ochiq — hafta kuni boshlanishiga qarab", () => {
    expect(isOpenAt(night, at("2026-10-13", "00:00"))).toBe(true);
    expect(isOpenAt(night, at("2026-10-13", "01:00"))).toBe(true);
    expect(isOpenAt(night, at("2026-10-13", "01:59"))).toBe(true);
    expect(isOpenAt(night, at("2026-10-13", "02:00"))).toBe(false);
  });

  it("seshanba 22:00 da yopiq (seshanba ro'yxatda yo'q), dushanba 01:00 da ham yopiq (yakshanba yo'q)", () => {
    expect(isOpenAt(night, at("2026-10-13", "22:30"))).toBe(false);
    expect(isOpenAt(night, at("2026-10-19", "01:00"))).toBe(false);
  });

  it("oraliq boshlangan sana qaytadi — kunlik limit shu kunga yoziladi", () => {
    expect(openWindowStart(night, at("2026-10-13", "01:00"))).toEqual(day("2026-10-12"));
    expect(openWindowStart(night, at("2026-10-12", "23:00"))).toEqual(day("2026-10-12"));
  });

  it("muddatning oxirgi kuni boshlangan oraliq ertasiga tunda ham amal qiladi", () => {
    // 19.10 — dushanba, endsOn; oraliq 20.10 01:00 gacha davom etadi
    expect(isOpenAt(night, at("2026-10-20", "01:00"))).toBe(true);
    // muddatdan oldingi kun boshlangan oraliq amal qilmaydi: 12.10 00:30 — 11.10 (yakshanba) davomi
    expect(isOpenAt({ ...night, weekdays: [7] }, at("2026-10-12", "00:30"))).toBe(false);
  });

  it("yakshanba → dushanba o'tishi (hafta chegarasi)", () => {
    const sunday: Schedule = { ...night, weekdays: [7], startsOn: day("2026-10-01"), endsOn: day("2026-10-31") };
    expect(isOpenAt(sunday, at("2026-10-18", "23:00"))).toBe(true); // yakshanba
    expect(isOpenAt(sunday, at("2026-10-19", "01:30"))).toBe(true); // dushanba tongi
    expect(isOpenAt(sunday, at("2026-10-19", "23:00"))).toBe(false);
  });

  it("UTC bo'yicha kun boshqa bo'lsa ham Toshkent vaqti hisobga olinadi", () => {
    // 12.10 18:30 UTC = 12.10 23:30 Toshkent (dushanba)
    expect(isOpenAt(night, new Date("2026-10-12T18:30:00Z"))).toBe(true);
    // 12.10 20:30 UTC = 13.10 01:30 Toshkent
    expect(isOpenAt(night, new Date("2026-10-12T20:30:00Z"))).toBe(true);
  });

  it("24:00 gacha bo'lgan oraliq yarim tundan o'tmaydi", () => {
    const evening: Schedule = { ...night, weekdays: [1], fromMinute: 18 * 60, toMinute: 1440 };
    expect(isOpenAt(evening, at("2026-10-12", "23:59"))).toBe(true);
    expect(isOpenAt(evening, at("2026-10-13", "00:00"))).toBe(false);
  });
});

describe("keyingi oraliq va lenta holati", () => {
  // Du–Ju 12:00–15:00, 01.10–31.10.2026. 13.10.2026 — seshanba.
  const lunch: Schedule = { weekdays: [1, 2, 3, 4, 5], fromMinute: 720, toMinute: 900, startsOn: day("2026-10-01"), endsOn: day("2026-10-31") };

  it("ochiq paytda: oraliq kuni va yopilish vaqti", () => {
    const timing = dealTiming(lunch, utc("2026-10-13T09:20:00Z")); // 14:20
    expect(timing).toEqual({ live: true, windowDate: day("2026-10-13"), closesAt: fromTashkent(day("2026-10-13"), 900) });
  });

  it("oraliqdan oldin — bugun ochiladi", () => {
    const timing = dealTiming(lunch, utc("2026-10-13T04:00:00Z")); // 09:00
    expect(timing).toEqual({ live: false, windowDate: day("2026-10-13"), opensAt: fromTashkent(day("2026-10-13"), 720) });
  });

  it("oraliqdan keyin — ertaga ochiladi", () => {
    expect(nextWindowStart(lunch, utc("2026-10-13T10:00:00Z"))).toEqual(day("2026-10-14")); // 15:00 — yopildi
  });

  it("juma kechqurun — dushanba ochiladi", () => {
    expect(nextWindowStart(lunch, utc("2026-10-16T12:00:00Z"))).toEqual(day("2026-10-19"));
  });

  it("muddat boshlanmagan — boshlanish kunidan", () => {
    const later = { ...lunch, startsOn: day("2026-11-02"), endsOn: day("2026-11-30") };
    expect(nextWindowStart(later, utc("2026-10-13T09:20:00Z"))).toEqual(day("2026-11-02"));
  });

  it("muddat tugagan — boshqa oraliq yo'q", () => {
    expect(dealTiming(lunch, utc("2026-10-30T11:00:00Z"))).toBeNull(); // juma 16:00, keyingi ish kuni — 02.11
  });

  it("faqat seshanba: keyingi seshanbagacha 7 kun", () => {
    const kino = { ...lunch, weekdays: [2], fromMinute: 600, toMinute: 1380 };
    expect(nextWindowStart(kino, utc("2026-10-13T19:00:00Z"))).toEqual(day("2026-10-20")); // seshanba 24:00
  });

  it("yarim tundan o'tadigan oraliq ertasi kuni yopiladi", () => {
    const night = { ...lunch, weekdays: [1, 2, 3, 4, 5, 6, 7], fromMinute: 1320, toMinute: 120 };
    expect(windowEnd(night, day("2026-10-13"))).toEqual(fromTashkent(day("2026-10-14"), 120));
    const timing = dealTiming(night, utc("2026-10-13T20:30:00Z")); // 14-oktabr 01:30
    expect(timing).toEqual({ live: true, windowDate: day("2026-10-13"), closesAt: fromTashkent(day("2026-10-14"), 120) });
  });
});
