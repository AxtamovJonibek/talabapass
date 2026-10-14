import { describe, expect, it } from "vitest";
import { authCookieOptions } from "./cookie-options";

describe("auth cookie atributlari", () => {
  it("production: httpOnly, Secure, SameSite=Lax", () => {
    expect(authCookieOptions(30 * 86_400_000, "production")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86_400,
    });
  });

  it("Secure faqat `next dev` da o'chadi — boshqa har qanday muhitda yoqilgan", () => {
    expect(authCookieOptions(1000, "development").secure).toBe(false);
    for (const env of ["production", "test", "staging", undefined, ""]) {
      expect(authCookieOptions(1000, env).secure, String(env)).toBe(true);
    }
  });

  it("httpOnly va SameSite=Lax har doim", () => {
    for (const env of ["development", "production", "test"]) {
      const options = authCookieOptions(1000, env);
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
    }
  });
});
