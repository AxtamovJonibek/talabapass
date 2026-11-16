/**
 * SEO: sayt manzili, indekslash kaliti, sahifa metadata'si va JSON-LD. Sof modul (proxy ham import qiladi — server importi yo'q).
 * Yoqish tartibi — docs/seo.md.
 */
import type { Metadata } from "next";
import { CONTACTS } from "./contacts";
import { localizedPath } from "@/i18n/routing";

export const SITE_URL = "https://talabapass.uz";
export const SITE_NAME = "Talaba Pass";
export const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: SITE_NAME } as const;

type Env = Record<string, string | undefined>;

/**
 * `SEO_INDEXABLE=true` bo'lsagina ochiq sahifalar indekslanadi; aks holda butun sayt noindex va robots.txt `Disallow: /`.
 * Build vaqtida ham o'qiladi (statik sahifalar metadata'si, robots.txt) — o'zgartirilsa qayta deploy kerak.
 */
export function seoIndexable(env: Env = process.env): boolean {
  return (env.SEO_INDEXABLE ?? "").trim().toLowerCase() === "true";
}

/** Indekslanadigan ochiq sahifalar (til prefiksisiz) — sitemap, sahifa metadata'si va proxy'dagi X-Robots-Tag shu ro'yxatdan. */
export const PUBLIC_PAGES = ["/", "/ilova", "/huquqiy/maxfiylik", "/huquqiy/shartlar", "/huquqiy/biznes", "/hisobni-ochirish"] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];

/** `/uz`, `/uz/ilova` … ochiq sahifami (oxiridagi `/` e'tiborsiz). */
export function isPublicPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_PAGES.some((page) => localizedPath(page) === path);
}

/** robots.txt: panel, kirish/ro'yxat, API va ilova ichidagi sahifalar (hammasi baribir noindex). */
export const ROBOTS_DISALLOW = [
  "/api/",
  "/uz/admin",
  "/uz/biznes",
  "/uz/kirish",
  "/uz/talaba",
  "/uz/kassir",
  "/uz/chegirmalar",
  "/uz/kuponlar",
  "/uz/tarix",
  "/uz/profil",
  "/uz/buyurtmalar",
  "/uz/bildirishnomalar",
  "/uz/yordam",
  "/uz/test-tolov",
  "/uz/oflayn",
  "/uz/dev",
  "/uz/ilova/biznes",
];

const NOINDEX = { index: false, follow: false } as const;

/** Ochiq sahifa metadata'si: title (to'liq), description, canonical, Open Graph, Twitter, robots. */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: PublicPage }): Metadata {
  const url = localizedPath(path);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "uz_UZ", url, title, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
    robots: seoIndexable() ? { index: true, follow: true } : NOINDEX,
  };
}

/** Ildiz layout: hamma sahifa uchun umumiy qism. Robots — har doim noindex; ochiq sahifalar `pageMetadata` bilan ochadi. */
export function baseMetadata({ title, description }: { title: string; description: string }): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    title: { default: title, template: `%s | ${SITE_NAME}` },
    description,
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    },
    appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "uz_UZ", title, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
    robots: NOINDEX,
  };
}

/** JSON-LD: tashkilot (logo — /logo.png). */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "talabaPass",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    email: CONTACTS.email,
    sameAs: [CONTACTS.telegramChannel, CONTACTS.instagram],
  };
}

/** JSON-LD: sayt (qidiruv — SearchAction yo'q). */
export function websiteLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}${localizedPath("/")}`, inLanguage: "uz" };
}

/** JSON-LD: ichki sahifa uchun "Bosh sahifa → sahifa". */
export function breadcrumbLd(home: string, page: { name: string; path: PublicPage }) {
  const items = [
    { name: home, path: "/" },
    { name: page.name, path: page.path },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: `${SITE_URL}${localizedPath(item.path)}` })),
  };
}
