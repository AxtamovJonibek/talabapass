import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

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
    for (const path of ["/", "/kirish", "/chegirmalar", "/biznes"]) {
      const response = proxy(request(path));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("www-authenticate"), path).toBeNull();
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    }
  });

  it("production: noindex yo'q", () => {
    vi.stubEnv("APP_ENV", "");
    const response = proxy(request("/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});
