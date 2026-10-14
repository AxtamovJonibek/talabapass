import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { stagingAuthorized } from "./staging-auth";

// next-intl middleware Vitest'da yuklanmaydi (ESM `next/server` yo'li); bu yerda faqat Basic Auth tekshiriladi.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});

const PASSWORD = "sinov-parol-2026";
const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

describe("Basic Auth tekshiruvi", () => {
  it("to'g'ri parol (foydalanuvchi nomi ixtiyoriy)", () => {
    expect(stagingAuthorized(basic("talaba", PASSWORD), PASSWORD)).toBe(true);
    expect(stagingAuthorized(basic("", PASSWORD), PASSWORD)).toBe(true);
    expect(stagingAuthorized(`basic   ${btoa(`x:${PASSWORD}`)}`, PASSWORD)).toBe(true);
  });

  it("noto'g'ri, qisman yoki ortiqcha parol rad etiladi", () => {
    for (const pass of ["", "sinov", `${PASSWORD}x`, PASSWORD.toUpperCase()]) {
      expect(stagingAuthorized(basic("u", pass), PASSWORD), pass).toBe(false);
    }
  });

  it("yaroqsiz sarlavha rad etiladi", () => {
    expect(stagingAuthorized(null, PASSWORD)).toBe(false);
    expect(stagingAuthorized(`Bearer ${PASSWORD}`, PASSWORD)).toBe(false);
    expect(stagingAuthorized("Basic !!!", PASSWORD)).toBe(false);
    expect(stagingAuthorized(`Basic ${btoa(PASSWORD)}`, PASSWORD)).toBe(false); // ikki nuqtasiz
  });

  it("parol o'rnatilmagan bo'lsa hech kim o'tmaydi", () => {
    expect(stagingAuthorized(basic("u", ""), undefined)).toBe(false);
    expect(stagingAuthorized(basic("u", ""), "")).toBe(false);
  });
});

describe("proxy", () => {
  afterEach(() => vi.unstubAllEnvs());
  const request = (path: string, auth?: string) =>
    new NextRequest(`https://sinov.talabapass.uz${path}`, { headers: auth ? { authorization: auth } : {} });

  it("staging: parolsiz har qanday sahifa va fayl 401 + noindex", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_PASSWORD", PASSWORD);
    for (const path of ["/", "/kirish", "/admin", "/robots.txt", "/favicon.ico"]) {
      const response = proxy(request(path));
      expect(response.status, path).toBe(401);
      expect(response.headers.get("www-authenticate"), path).toMatch(/^Basic /);
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    }
    expect(proxy(request("/kirish", basic("u", "xato"))).status).toBe(401);
  });

  it("staging: to'g'ri parol bilan o'tadi, noindex sarlavhasi bilan", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_PASSWORD", PASSWORD);
    const response = proxy(request("/kirish", basic("u", PASSWORD)));
    expect(response.status).not.toBe(401);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("staging: parol o'rnatilmagan bo'lsa ham yopiq", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("STAGING_PASSWORD", "");
    expect(proxy(request("/", basic("u", ""))).status).toBe(401);
  });

  it("production: Basic Auth yo'q, noindex yo'q", () => {
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("STAGING_PASSWORD", PASSWORD);
    const response = proxy(request("/kirish"));
    expect(response.status).not.toBe(401);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});
