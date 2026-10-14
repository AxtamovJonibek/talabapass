import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { StagingBadge } from "@/components/StagingBadge";
import { isStaging } from "@/server/env-check";
import "../globals.css";

// Archivo — variable shrift; `wdth` o'qi dizayndagi font-stretch (62–125%) uchun shart.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
    ...(isStaging() && { robots: { index: false, follow: false } }),
  };
}

export const viewport: Viewport = {
  themeColor: "#141414",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });

  return (
    <html lang={locale} className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        {isStaging() && <StagingBadge label={t("stagingBadge")} />}
      </body>
    </html>
  );
}
