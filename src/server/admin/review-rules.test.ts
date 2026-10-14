import { describe, expect, it } from "vitest";
import { fromTashkent } from "@/lib/time";
import { ageLabel, averageWait, checkCardExpiry, normalizeCardNumber, parseDateInput } from "./review-rules";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("normalizeCardNumber", () => {
  it("katta harf, bo'sh joysiz", () => {
    expect(normalizeCardNumber(" ozmu-24-11872 ")).toBe("OZMU-24-11872");
    expect(normalizeCardNumber("U 2312 045")).toBe("U2312045");
  });

  it("noto'g'ri qiymatlar", () => {
    for (const bad of ["", "ab", "-ABC123", "TDYU-25-0?3?8", "a".repeat(31), "<script>"]) expect(normalizeCardNumber(bad), bad).toBeNull();
  });
});

describe("parseDateInput", () => {
  it("to'g'ri sana", () => {
    expect(parseDateInput("2027-06-30")).toEqual(day("2027-06-30"));
  });

  it("mavjud bo'lmagan va noto'g'ri formatdagi sanalar", () => {
    for (const bad of ["2027-02-30", "2027-13-01", "30.06.2027", "", "2027-6-30"]) expect(parseDateInput(bad), bad).toBeNull();
  });
});

describe("checkCardExpiry", () => {
  const now = fromTashkent(day("2026-10-14"), 600);

  it("bugun va undan keyin — amalda", () => {
    expect(checkCardExpiry(day("2026-10-14"), now)).toBe("valid");
    expect(checkCardExpiry(day("2027-06-30"), now)).toBe("valid");
  });

  it("kecha tugagan — o'tgan", () => {
    expect(checkCardExpiry(day("2026-10-13"), now)).toBe("expired");
  });

  it("7 yildan uzoq — yozuv xatosi bo'lishi mumkin", () => {
    expect(checkCardExpiry(day("2033-10-14"), now)).toBe("valid");
    expect(checkCardExpiry(day("2033-10-15"), now)).toBe("too_far");
  });
});

describe("ageLabel", () => {
  const now = new Date("2026-10-14T10:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);

  it("daqiqa, soat, kun", () => {
    expect(ageLabel(ago(12), now)).toEqual({ value: 12, unit: "min" });
    expect(ageLabel(ago(150), now)).toEqual({ value: 2, unit: "hour" });
    expect(ageLabel(ago(26 * 60), now)).toEqual({ value: 1, unit: "day" });
    expect(ageLabel(new Date(now.getTime() + 5000), now)).toEqual({ value: 0, unit: "min" });
  });
});

describe("averageWait", () => {
  it("o'rtacha soat va daqiqa", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 9, 14, h));
    expect(averageWait([{ createdAt: at(8), reviewedAt: at(9) }, { createdAt: at(8), reviewedAt: new Date(at(10).getTime() + 20 * 60_000) }])).toEqual({ hours: 1, minutes: 40 });
    expect(averageWait([])).toBeNull();
  });
});
