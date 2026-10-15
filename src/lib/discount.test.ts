import { describe, expect, it } from "vitest";
import { contentChanged, discountTerms, formatDateRange, parseAmount, parseDateRange, validateDiscount, weekdaysLabel, type DiscountDraft } from "./discount";

const TODAY = "2026-10-14";
const base: DiscountDraft = {
  title: "Osh 0.5 porsiya + ko'k choy",
  type: "PERCENT",
  originalPrice: 38000,
  percent: 30,
  newPrice: null,
  weekdays: [1, 2, 3, 4, 5],
  fromMinute: 720,
  toMinute: 900,
  dailyLimit: 60,
  perStudentLimit: "DAILY",
  startsOn: "2026-10-14",
  endsOn: "2026-10-31",
  terms: "",
};
const check = (patch: Partial<DiscountDraft>) => validateDiscount({ ...base, ...patch }, TODAY);

describe("validateDiscount", () => {
  it("to'g'ri chegirma", () => {
    expect(check({})).toEqual({});
  });

  it("foiz 1–100", () => {
    expect(check({ percent: 1 })).toEqual({});
    expect(check({ percent: 7 })).toEqual({});
    expect(check({ percent: 100 })).toEqual({});
    expect(check({ percent: 0 }).percent).toBe("percentRange");
    expect(check({ percent: 101 }).percent).toBe("percentRange");
    expect(check({ percent: 30.5 }).percent).toBe("percentRange");
    expect(check({ percent: null }).percent).toBe("percentRange");
  });

  it("yangi narx asl narxdan kichik va musbat", () => {
    const fixed = { type: "FIXED_PRICE" as const, percent: null };
    expect(check({ ...fixed, newPrice: 26000 })).toEqual({});
    expect(check({ ...fixed, newPrice: 38000 }).newPrice).toBe("newPriceBelowOriginal");
    expect(check({ ...fixed, newPrice: 40000 }).newPrice).toBe("newPriceBelowOriginal");
    expect(check({ ...fixed, newPrice: 0 }).newPrice).toBe("newPriceBelowOriginal");
    expect(check({ ...fixed, newPrice: null }).newPrice).toBe("newPriceBelowOriginal");
  });

  it("asl narx majburiy (1+1 dan tashqari) va butun musbat son", () => {
    expect(check({ originalPrice: null }).originalPrice).toBe("originalPrice");
    expect(check({ originalPrice: 0 }).originalPrice).toBe("originalPrice");
    expect(check({ originalPrice: -5 }).originalPrice).toBe("originalPrice");
    expect(check({ type: "BOGO", percent: null, originalPrice: null })).toEqual({});
  });

  it("kunlik limit > 0", () => {
    expect(check({ dailyLimit: 1 })).toEqual({});
    expect(check({ dailyLimit: 0 }).dailyLimit).toBe("dailyLimit");
    expect(check({ dailyLimit: -3 }).dailyLimit).toBe("dailyLimit");
    expect(check({ dailyLimit: null }).dailyLimit).toBe("dailyLimit");
  });

  it("muddat oxiri boshidan keyin, boshlanish o'tmishda emas", () => {
    expect(check({ endsOn: "2026-10-15" })).toEqual({});
    expect(check({ endsOn: "2026-10-14" }).dates).toBe("endAfterStart");
    expect(check({ endsOn: "2026-10-01" }).dates).toBe("endAfterStart");
    expect(check({ startsOn: "2026-10-13", endsOn: "2026-10-20" }).dates).toBe("startInPast");
    expect(check({ startsOn: "2026-02-30" }).dates).toBe("dates");
  });

  it("kamida bitta hafta kuni", () => {
    expect(check({ weekdays: [] }).weekdays).toBe("weekdays");
    expect(check({ weekdays: [0] }).weekdays).toBe("weekdays");
    expect(check({ weekdays: [8] }).weekdays).toBe("weekdays");
  });

  it("vaqt: yarim tundan o'tishi mumkin, lekin bir xil bo'lmasin", () => {
    expect(check({ fromMinute: 22 * 60, toMinute: 2 * 60 })).toEqual({});
    expect(check({ fromMinute: 720, toMinute: 720 }).time).toBe("sameTime");
    expect(check({ fromMinute: null }).time).toBe("time");
    expect(check({ fromMinute: 1440 }).time).toBe("time");
  });

  it("nom 3–80 belgi", () => {
    expect(check({ title: "ab" }).title).toBe("title");
    expect(check({ title: "  " }).title).toBe("title");
    expect(check({ title: "x".repeat(81) }).title).toBe("title");
  });
});

describe("discountTerms", () => {
  it("foiz: 100 so'mgacha yaxlitlanadi", () => {
    expect(discountTerms(base)).toEqual({ badge: "−30%", originalPrice: 38000, discountAmount: 11400, finalPrice: 26600 });
  });

  it("yangi narx", () => {
    expect(discountTerms({ type: "FIXED_PRICE", originalPrice: 45000, newPrice: 25000, percent: null })).toEqual({
      badge: "−44%",
      originalPrice: 45000,
      discountAmount: 20000,
      finalPrice: 25000,
    });
  });

  it("1+1: ikkitasining narxi, bittasi to'lanadi", () => {
    expect(discountTerms({ type: "BOGO", originalPrice: 32000, percent: null, newPrice: null })).toEqual({
      badge: "1+1",
      originalPrice: 64000,
      discountAmount: 32000,
      finalPrice: 32000,
    });
  });

  it("narxsiz foiz (chekdan): summalar kassada", () => {
    expect(discountTerms({ type: "PERCENT", percent: 15, originalPrice: null, newPrice: null })).toEqual({
      badge: "−15%",
      originalPrice: null,
      discountAmount: null,
      finalPrice: null,
    });
  });
});

describe("contentChanged — qayta tekshiruvga tushish", () => {
  it("nom, tur, narx, foiz yoki shartlar o'zgarsa — ha", () => {
    expect(contentChanged(base, { ...base, title: "Boshqa nom" })).toBe(true);
    expect(contentChanged(base, { ...base, percent: 40 })).toBe(true);
    expect(contentChanged(base, { ...base, originalPrice: 40000 })).toBe(true);
    expect(contentChanged(base, { ...base, type: "BOGO" })).toBe(true);
    expect(contentChanged(base, { ...base, terms: "Faqat joyida" })).toBe(true);
  });

  it("faqat bo'sh joy farqi — yo'q", () => {
    expect(contentChanged(base, { ...base, title: ` ${base.title} ` })).toBe(false);
  });
});

describe("formadagi matnlar", () => {
  it("parseAmount", () => {
    expect(parseAmount("38 000")).toBe(38000);
    expect(parseAmount("60 ta")).toBe(60);
    expect(parseAmount("26 000 so'm")).toBe(26000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12a")).toBeNull();
  });

  it("parseDateRange: yilsiz va yilli", () => {
    expect(parseDateRange("13.10 – 31.10", "2026-10-14")).toEqual({ startsOn: "2026-10-13", endsOn: "2026-10-31" });
    expect(parseDateRange("20.12-15.01", "2026-10-14")).toEqual({ startsOn: "2026-12-20", endsOn: "2027-01-15" });
    // yanvar oktyabrda yozilsa — kelasi yil
    expect(parseDateRange("05.01 – 20.01", "2026-10-14")).toEqual({ startsOn: "2027-01-05", endsOn: "2027-01-20" });
    expect(parseDateRange("13.10.2026 – 02.11.2026", "2026-10-14")).toEqual({ startsOn: "2026-10-13", endsOn: "2026-11-02" });
    expect(parseDateRange("ertaga", "2026-10-14")).toBeNull();
  });

  it("formatDateRange", () => {
    expect(formatDateRange("2026-10-13", "2026-10-31", "2026-10-14")).toBe("13.10 – 31.10");
    expect(formatDateRange("2026-12-20", "2027-01-15", "2026-10-14")).toBe("20.12.2026 – 15.01.2027");
  });

  it("weekdaysLabel", () => {
    const names = (d: number) => ["", "Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"][d];
    expect(weekdaysLabel([1, 2, 3, 4, 5, 6, 7], names, "Har kuni")).toBe("Har kuni");
    expect(weekdaysLabel([1, 2, 3, 4, 5], names, "Har kuni")).toBe("Du–Ju");
    expect(weekdaysLabel([6, 7], names, "Har kuni")).toBe("Sh–Ya");
    expect(weekdaysLabel([1, 3], names, "Har kuni")).toBe("Du, Ch");
    expect(weekdaysLabel([1, 2, 5], names, "Har kuni")).toBe("Du, Se, Ju");
  });
});
