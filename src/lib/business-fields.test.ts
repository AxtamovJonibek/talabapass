import { describe, expect, it } from "vitest";
import { approvalGaps, canChangeField, changeText } from "./business-fields";

describe("canChangeField", () => {
  it("STIR, kategoriya, joylashuv va holat — faqat admin", () => {
    for (const f of ["tin", "kind", "lat", "lng", "status"]) {
      expect(canChangeField("ADMIN", f)).toBe(true);
      expect(canChangeField("OWNER", f)).toBe(false);
    }
  });
  it("nom, aloqa, tavsif, rasm, manzil, ish vaqti — ikkalasi", () => {
    for (const f of ["name", "publicPhone", "telegram", "instagram", "description", "logoKey", "address", "workingHours"]) {
      expect(canChangeField("ADMIN", f)).toBe(true);
      expect(canChangeField("OWNER", f)).toBe(true);
    }
  });
  it("noma'lum maydon — hech kim", () => {
    expect(canChangeField("ADMIN", "ownerId")).toBe(false);
    expect(canChangeField("OWNER", "receiptSeq")).toBe(false);
  });
});

describe("approvalGaps", () => {
  it("to'liq bo'lsa bo'sh", () => {
    expect(approvalGaps({ kind: "CAFE", workingHours: "Har kuni · 09:00–21:00", lat: 41.3, lng: 69.2 })).toEqual([]);
  });
  it("yetishmayotganini aytadi", () => {
    expect(approvalGaps({ kind: "CAFE", workingHours: " ", lat: null, lng: 69.2 })).toEqual(["workingHours", "location"]);
  });
});

describe("changeText", () => {
  it("bo'sh qiymat null", () => {
    expect(changeText("  ")).toBeNull();
    expect(changeText(undefined)).toBeNull();
    expect(changeText(41.3)).toBe("41.3");
  });
});
