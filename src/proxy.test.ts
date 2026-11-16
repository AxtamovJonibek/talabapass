import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy, { config } from "@/proxy";
import { localizedPath, routing } from "@/i18n/routing";

// next-intl middleware Vitest'da yuklanmaydi (ESM `next/server` yo'li); bu yerda faqat proxy'ning o'z qismi tekshiriladi.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});

describe("proxy", () => {
  afterEach(() => vi.unstubAllEnvs());
  const request = (path: string) => new NextRequest(`https://talabapass.uz${path}`);

  it("SEO_INDEXABLE yo'q/false: sahifalar ochiq (Basic Auth yo'q), hammasi noindex", () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("SEO_INDEXABLE", "false");
    for (const path of ["/", "/uz", "/uz/ilova", "/uz/kirish", "/uz/chegirmalar", "/uz/biznes"]) {
      const response = proxy(request(path));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("www-authenticate"), path).toBeNull();
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    }
  });

  it("public/ fayllari (Google Search Console tasdiqlash fayli) proxy'dan o'tmaydi: /uz ga yo'naltirilmaydi, noindex yo'q", () => {
    const matches = (path: string) => new RegExp(`^${config.matcher}$`).test(path);
    expect(matches("/googleafbb26fed356e93c.html")).toBe(false);
    expect(matches("/uz/kirish")).toBe(true);
  });

  it("SEO_INDEXABLE=true: ochiq sahifalarda noindex yo'q, panel/kirish doim noindex", () => {
    vi.stubEnv("SEO_INDEXABLE", "true");
    for (const path of ["/uz", "/uz/ilova", "/uz/huquqiy/maxfiylik", "/uz/hisobni-ochirish"]) {
      const response = proxy(request(path));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("x-robots-tag"), path).toBeNull();
    }
    for (const path of ["/uz/kirish", "/uz/admin", "/uz/biznes", "/uz/chegirmalar", "/uz/talaba/royxat"]) {
      expect(proxy(request(path)).headers.get("x-robots-tag"), path).toBe("noindex");
    }
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
