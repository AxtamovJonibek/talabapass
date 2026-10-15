import { describe, expect, it } from "vitest";
import { formatTin, normalizeHandle, normalizeTin, validateBusiness, validateContacts, type BusinessInfo } from "./business";

const base: BusinessInfo = {
  name: "Bodom Choyxonasi",
  kind: "CAFE",
  address: "Bunyodkor ko'chasi 14, Chilonzor",
  workingHours: "09:00 – 23:00",
  description: "Toshkent oshi, somsa va choy. 60 o'rinli zal.",
  tin: "307 482 915",
  contactName: "Shavkat Yo'ldoshev",
};
const check = (patch: Partial<BusinessInfo>) => validateBusiness({ ...base, ...patch });

describe("validateBusiness", () => {
  it("to'g'ri ariza", () => {
    expect(check({})).toEqual([]);
  });

  it("nom, manzil, ish vaqti majburiy", () => {
    expect(check({ name: " " })).toEqual(["name"]);
    expect(check({ address: "abc" })).toEqual(["address"]);
    expect(check({ workingHours: "" })).toEqual(["workingHours"]);
  });

  it("kategoriya faqat ro'yxatdan", () => {
    expect(check({ kind: "" })).toEqual(["kind"]);
    expect(check({ kind: "CASINO" })).toEqual(["kind"]);
  });

  it("tavsif 120 belgigacha, bo'sh bo'lishi mumkin", () => {
    expect(check({ description: "" })).toEqual([]);
    expect(check({ description: "x".repeat(120) })).toEqual([]);
    expect(check({ description: "x".repeat(121) })).toEqual(["description"]);
  });

  it("STIR — 9 raqam", () => {
    expect(check({ tin: "307482915" })).toEqual([]);
    expect(check({ tin: "30748291" })).toEqual(["tin"]);
    expect(check({ tin: "30748291a" })).toEqual(["tin"]);
  });

  it("mas'ul shaxs — ism", () => {
    expect(check({ contactName: "" })).toEqual(["contactName"]);
    expect(check({ contactName: "123" })).toEqual(["contactName"]);
  });

  it("faqat berilgan qadam maydonlari tekshiriladi", () => {
    expect(validateBusiness({ ...base, tin: "", contactName: "" }, ["name", "kind"])).toEqual([]);
  });
});

describe("STIR formati", () => {
  it("normalizeTin / formatTin", () => {
    expect(normalizeTin("307 482 915")).toBe("307482915");
    expect(normalizeTin("307-482-915")).toBe("307482915");
    expect(normalizeTin("3074829150")).toBeNull();
    expect(formatTin("307482915")).toBe("307 482 915");
  });
});

describe("aloqa maydonlari (talabaga ko'rinadigan)", () => {
  const input = { phone: "", telegram: "", instagram: "" };

  it("bo'sh maydonlar — null, xato yo'q", () => {
    expect(validateContacts(input)).toEqual({ ok: true, value: { phone: null, telegram: null, instagram: null } });
  });

  it("telefon E.164 ga, nomlar havola va @ dan tozalanadi", () => {
    expect(validateContacts({ phone: "90 123 45 67", telegram: "https://t.me/choyxona_bahor", instagram: "@choyxona.bahor" })).toEqual({
      ok: true,
      value: { phone: "+998901234567", telegram: "choyxona_bahor", instagram: "choyxona.bahor" },
    });
    expect(normalizeHandle("instagram", "https://www.instagram.com/choyxona/?hl=uz")).toBe("choyxona");
  });

  it("noto'g'ri qiymatlar maydon nomi bilan qaytadi", () => {
    expect(validateContacts({ phone: "+7 900 123 45 67", telegram: "ab", instagram: "a b" })).toEqual({ ok: false, fields: ["phone", "telegram", "instagram"] });
    expect(normalizeHandle("telegram", "1abcde")).toBeUndefined();
    expect(normalizeHandle("instagram", "a..b")).toBeUndefined();
  });
});
