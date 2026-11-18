import { describe, expect, it } from "vitest";
import { maskEmail, normalizeEmail, parseIdentifier } from "./identifier";

describe("parseIdentifier", () => {
  it("telefon: 9 raqam, +998 bilan, bo'shliqlar bilan", () => {
    expect(parseIdentifier("90 123 45 67")).toEqual({ kind: "phone", value: "+998901234567" });
    expect(parseIdentifier("+998 90 123-45-67")).toEqual({ kind: "phone", value: "+998901234567" });
  });

  it("email: kichik harfga, chetidagi bo'shliqsiz", () => {
    expect(parseIdentifier("  Dilnoza.K@Gmail.com ")).toEqual({ kind: "email", value: "dilnoza.k@gmail.com" });
  });

  it("tanilmaydigan qiymat — null", () => {
    expect(parseIdentifier("")).toBeNull();
    expect(parseIdentifier("12345")).toBeNull();
    expect(parseIdentifier("+7 912 345 67 89")).toBeNull();
    expect(parseIdentifier("dilnoza@")).toBeNull();
    expect(parseIdentifier("a b@c.uz")).toBeNull();
  });

  it("juda uzun email rad etiladi", () => {
    expect(normalizeEmail(`${"a".repeat(250)}@x.uz`)).toBeNull();
  });
});

describe("maskEmail", () => {
  it("nomning boshi va domen qoladi", () => {
    expect(maskEmail("dilnoza@gmail.com")).toBe("di•••@gmail.com");
    expect(maskEmail("ab@mail.ru")).toBe("a•••@mail.ru");
  });
});
