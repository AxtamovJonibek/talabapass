import { describe, expect, it } from "vitest";
import { breadcrumbLd, isPublicPath, pageMetadata, PUBLIC_PAGES, ROBOTS_DISALLOW, seoIndexable } from "./seo";

describe("seoIndexable", () => {
  it("faqat aniq 'true' qiymatida", () => {
    expect(seoIndexable({ SEO_INDEXABLE: "true" })).toBe(true);
    expect(seoIndexable({ SEO_INDEXABLE: " TRUE " })).toBe(true);
    expect(seoIndexable({ SEO_INDEXABLE: "false" })).toBe(false);
    expect(seoIndexable({ SEO_INDEXABLE: "1" })).toBe(false);
    expect(seoIndexable({})).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("ochiq sahifalar", () => {
    for (const path of ["/uz", "/uz/", "/uz/ilova", "/uz/huquqiy/maxfiylik", "/uz/hisobni-ochirish"]) expect(isPublicPath(path), path).toBe(true);
  });
  it("panel, kirish, ro'yxat — yopiq", () => {
    for (const path of ["/", "/uz/kirish", "/uz/admin", "/uz/biznes", "/uz/biznes/royxat", "/uz/chegirmalar", "/uz/ilova/biznes", "/uz/talaba/royxat"]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });
});

describe("robots va sitemap ro'yxatlari", () => {
  it("ochiq sahifa robots.txt da yopilmagan", () => {
    for (const page of PUBLIC_PAGES) {
      const url = page === "/" ? "/uz" : `/uz${page}`;
      expect(ROBOTS_DISALLOW.some((rule) => url.startsWith(rule)), url).toBe(false);
    }
  });
});

describe("pageMetadata", () => {
  it("canonical, OG va robots", () => {
    const meta = pageMetadata({ title: "T", description: "D", path: "/ilova" });
    expect(meta.alternates?.canonical).toBe("/uz/ilova");
    expect(meta.openGraph).toMatchObject({ url: "/uz/ilova", title: "T", description: "D" });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe("breadcrumbLd", () => {
  it("bosh sahifa → sahifa, to'liq URL", () => {
    const ld = breadcrumbLd("Bosh sahifa", { name: "Mobil ilova", path: "/ilova" });
    expect(ld.itemListElement.map((i) => i.item)).toEqual(["https://talabapass.uz/uz", "https://talabapass.uz/uz/ilova"]);
  });
});
