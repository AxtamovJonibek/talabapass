import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { localizedPath, routing } from "@/i18n/routing";

// next-intl middleware Vitest'da yuklanmaydi (ESM `next/server` yo'li); bu yerda faqat proxy'ning o'z qismi tekshiriladi.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});

describe("proxy", () => {
  afterEach(() => vi.unstubAllEnvs());
  const request = (path: string) => new NextRequest(`https://talabapass.vercel.app${path}`);

  it("staging: sahifalar ochiq (Basic Auth yo'q), noindex sarlavhasi bilan", () => {
    vi.stubEnv("APP_ENV", "staging");
    for (const path of ["/", "/uz", "/uz/kirish", "/uz/chegirmalar", "/uz/biznes"]) {
      const response = proxy(request(path));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("www-authenticate"), path).toBeNull();
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    }
  });

  it("production: noindex yo'q", () => {
    vi.stubEnv("APP_ENV", "");
    const response = proxy(request("/uz"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("til prefiksi", () => {
  // "as-needed" dagi "/" → "/uz" ichki rewrite nginx orqasida cheksiz 307 berardi
  it("har doim prefiks bilan", () => {
    expect(routing.localePrefix).toBe("always");
  });

  it("localizedPath", () => {
    expect(localizedPath("/")).toBe("/uz");
    expect(localizedPath("/kirish")).toBe("/uz/kirish");
    expect(localizedPath("/kirish?rol=biznes")).toBe("/uz/kirish?rol=biznes");
    expect(localizedPath("/#savollar")).toBe("/uz#savollar");
    expect(localizedPath("/?q=1")).toBe("/uz?q=1");
  });
});
