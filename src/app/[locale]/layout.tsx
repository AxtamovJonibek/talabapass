import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { StagingBadge } from "@/components/StagingBadge";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { isStaging } from "@/server/env-check";
import "../globals.css";

// Archivo — variable shrift; `wdth` o'qi dizayndagi font-stretch (62–125%) uchun shart.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
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
    manifest: "/manifest.webmanifest",
    icons: { apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "talabaPass", statusBarStyle: "default" },
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
    <html lang={locale} className={`${archivo.variable}`}>
      <body>
        <NextIntlClientProvider>
          {children}
          <Suspense fallback={null}>
            <ServiceWorkerRegister />
          </Suspense>
        </NextIntlClientProvider>
        {isStaging() && <StagingBadge label={t("stagingBadge")} />}
      </body>
    </html>
  );
}
