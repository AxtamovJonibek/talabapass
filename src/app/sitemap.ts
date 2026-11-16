import type { MetadataRoute } from "next";
import { localizedPath } from "@/i18n/routing";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/seo";

// Faqat ochiq sahifalar (src/lib/seo.ts → PUBLIC_PAGES); panel, kirish va API yo'q.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((page) => ({
    url: `${SITE_URL}${localizedPath(page)}`,
    changeFrequency: page === "/" ? "daily" : "monthly",
    priority: page === "/" ? 1 : page === "/ilova" ? 0.8 : 0.3,
  }));
}
