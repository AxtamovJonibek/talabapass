import { describe, expect, it } from "vitest";
import { businessEditSchema, diffOf, failedFields, newAdminSchema, studentEditSchema, universityEditSchema, userEditSchema } from "./admin-manage";

describe("admin tahrir sxemalari", () => {
  it("telefon E.164 ga keltiriladi, begona raqam rad etiladi", () => {
    expect(userEditSchema.parse({ firstName: "Ali", lastName: "Valiyev", phone: "90 123 45 67" }).phone).toBe("+998901234567");
    const bad = userEditSchema.safeParse({ firstName: "Ali", lastName: "Valiyev", phone: "+7 900 123 45 67" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(failedFields(bad.error)).toEqual(["phone"]);
  });

  it("yangi admin: ism, familiya va telefon majburiy", () => {
    expect(newAdminSchema.safeParse({ firstName: "A", lastName: "", phone: "" }).success).toBe(false);
    expect(newAdminSchema.parse({ firstName: "Dilnoza", lastName: "Karimova", phone: "+998901112233" }).phone).toBe("+998901112233");
  });

  it("talaba: bo'sh maydon — null, sana to'g'ri bo'lishi kerak", () => {
    const ok = studentEditSchema.parse({ course: "C2", faculty: "", universityId: "u1", districtId: "", cardNumber: "", cardExpiresAt: "" });
    expect(ok).toMatchObject({ faculty: null, districtId: null, cardNumber: null, cardExpiresAt: null });
    const bad = studentEditSchema.safeParse({ course: "C9", faculty: "", universityId: "u1", districtId: "", cardNumber: "", cardExpiresAt: "2026-02-30" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(failedFields(bad.error).sort()).toEqual(["cardExpiresAt", "course"]);
  });

  it("biznes: STIR, aloqa va nomlar tozalanadi", () => {
    const raw = {
      name: "Bodom", legalName: "", tin: "307 482 915", kind: "CAFE", typeLabel: "", address: "Toshkent, Chilonzor", landmark: "", workingHours: "09:00 – 23:00",
      description: "", contactName: "Shavkat", contactPhone: "", publicPhone: "90 111 22 33", telegram: "@bodom_osh", instagram: "",
    };
    const value = businessEditSchema.parse(raw);
    expect(value).toMatchObject({ tin: "307482915", publicPhone: "+998901112233", telegram: "bodom_osh", instagram: null, legalName: null });
    const bad = businessEditSchema.safeParse({ ...raw, tin: "123", telegram: "ab", publicPhone: "x" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(failedFields(bad.error).sort()).toEqual(["publicPhone", "telegram", "tin"]);
  });

  it("universitet: tur faqat davlat/nodavlat/xorijiy", () => {
    expect(universityEditSchema.safeParse({ name: "Yangi universitet", shortName: "YU", region: "Toshkent shahri", kind: "OTHER", active: true }).success).toBe(false);
    expect(universityEditSchema.safeParse({ name: "Yangi universitet", shortName: "YU", region: "Toshkent shahri", kind: "PRIVATE", active: true }).success).toBe(true);
  });

  it("diff: faqat o'zgargan maydonlar (sana — YYYY-MM-DD)", () => {
    expect(diffOf({ a: 1, b: "x", d: new Date("2027-01-01T00:00:00Z") }, { a: 1, b: "y", d: "2027-01-01", c: null })).toEqual({ b: ["x", "y"] });
  });
});
