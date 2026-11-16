import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW, SITE_URL, seoIndexable } from "@/lib/seo";

// SEO_INDEXABLE=false (hozir) — butun sayt yopiq; true — ochiq sahifalar, panel/kirish/API yopiq (docs/seo.md).
export default function robots(): MetadataRoute.Robots {
  if (!seoIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
