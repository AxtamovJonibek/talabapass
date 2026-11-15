import { describe, expect, it } from "vitest";
import { isValidPassword, maskPhone, passwordRules, passwordStrength } from "./password";

describe("ilova paroli qoidalari", () => {
  it("kamida 8 belgi va harf + raqam", () => {
    expect(isValidPassword("Talaba2026")).toBe(true);
    expect(isValidPassword("abc12345")).toBe(true);
    expect(isValidPassword("abc1234")).toBe(false);
    expect(isValidPassword("abcdefgh")).toBe(false);
    expect(isValidPassword("12345678")).toBe(false);
    expect(isValidPassword("        ")).toBe(false);
  });

  it("o'zbekcha harflar ham harf hisoblanadi, chetidagi bo'shliq hisobga olinmaydi", () => {
    expect(isValidPassword("gʻoʻzaoʻ1")).toBe(true);
    expect(passwordRules("  abc1234  ")).toEqual({ length: false, mix: true });
  });

  it("128 belgidan uzun parol qabul qilinmaydi", () => {
    expect(isValidPassword(`a1${"x".repeat(126)}`)).toBe(true);
    expect(isValidPassword(`a1${"x".repeat(127)}`)).toBe(false);
  });

  it("kuch shkalasi", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abc")).toBe(1);
    expect(passwordStrength("abc12345")).toBe(2);
    expect(passwordStrength("Talaba2026")).toBe(3);
    expect(passwordStrength("Talaba-2026")).toBe(4);
    expect(passwordStrength("Talaba-2026-yil")).toBe(4);
  });

  it("raqam yashiriladi", () => {
    expect(maskPhone("+998901234567")).toBe("+998 90 *** ** 67");
  });
});
