import { describe, expect, it } from "vitest";
import { dealBadge, formatMln, formatPhone, formatSom, initials, normalizePhone, priceAfterPercent } from "./format";

describe("formatSom", () => {
  it("minglik guruhlarni bo'sh joy bilan ajratadi", () => {
    expect(formatSom(300)).toBe("300");
    expect(formatSom(26600)).toBe("26 600");
    expect(formatSom(18354000)).toBe("18 354 000");
  });

  it("manfiy summada dizayndagi minus belgisini ishlatadi", () => {
    expect(formatSom(-11400)).toBe("−11 400");
  });
});

describe("formatMln", () => {
  it("dizayndagi kabi qisqartiradi", () => {
    expect(formatMln(1_220_000)).toBe("1.22 mln");
    expect(formatMln(30_120_000)).toBe("30.1 mln");
    expect(formatMln(12_000_000)).toBe("12 mln");
    expect(formatMln(466_800)).toBe("466 800");
  });
});

describe("priceAfterPercent", () => {
  it("100 so'mgacha yaxlitlaydi", () => {
    expect(priceAfterPercent(38000, 30)).toBe(26600);
    expect(priceAfterPercent(28000, 25)).toBe(21000);
    expect(priceAfterPercent(45000, 33)).toBe(30200);
  });
});

describe("dealBadge", () => {
  it("har bir tur uchun yorliq", () => {
    expect(dealBadge({ type: "PERCENT", percent: 30 })).toBe("−30%");
    expect(dealBadge({ type: "FIXED_PRICE", originalPrice: 45000, newPrice: 25000 })).toBe("−44%");
    expect(dealBadge({ type: "BOGO" })).toBe("1+1");
  });
});

describe("telefon", () => {
  it("turli ko'rinishlarni E.164 ga keltiradi", () => {
    expect(normalizePhone("90 412 37 85")).toBe("+998904123785");
    expect(normalizePhone("+998 (90) 412-37-85")).toBe("+998904123785");
    expect(normalizePhone("998904123785")).toBe("+998904123785");
  });

  it("faqat +998: boshqa davlat kodlari rad etiladi", () => {
    expect(normalizePhone("+7 904 123 78 56")).toBeNull();
    expect(normalizePhone("+7 90 412 37 85")).toBeNull();
    expect(normalizePhone("+1 904123785")).toBeNull();
    expect(normalizePhone("+44 7911 123456")).toBeNull();
    expect(normalizePhone("+99890412378")).toBeNull();
    expect(normalizePhone("79041237856")).toBeNull();
    expect(normalizePhone("0090412378599")).toBeNull();
    // natija har doim +998 bilan boshlanadi
    for (const input of ["90 412 37 85", "998904123785", "+998 90 412 37 85", " +998904123785 "]) {
      expect(normalizePhone(input)).toMatch(/^\+998\d{9}$/);
    }
  });

  it("noto'g'ri raqamni rad etadi", () => {
    expect(normalizePhone("90 412 37")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("1 90 412 37 85 5")).toBeNull();
  });

  it("ko'rsatish uchun formatlaydi", () => {
    expect(formatPhone("+998904123785")).toBe("+998 90 412 37 85");
  });
});

describe("initials", () => {
  it("bosh harflarni oladi", () => {
    expect(initials("Dilnoza", "Karimova")).toBe("DK");
    expect(initials("jasur", null)).toBe("J");
  });
});
