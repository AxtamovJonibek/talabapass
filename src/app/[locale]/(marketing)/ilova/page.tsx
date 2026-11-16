import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Intro } from "@/components/app/intro";
import { GuestOnly } from "@/components/auth/role-gate";
import { AppAbout } from "@/components/landing/app-about";
import { JsonLd } from "@/components/seo/json-ld";
import { resolveLocale } from "@/i18n/locale";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { isAppRequest } from "@/server/app-mode";

export async function generateMetadata({ params }: PageProps<"/[locale]/ilova">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "appPage" });
  return pageMetadata({ title: t("metaTitle"), description: t("metaDescription"), path: "/ilova" });
}

// Ilova (Capacitor) ichida — boshlanish sahifasi: birinchi ochilishda tanishtiruv (Main, Slide2–4), keyin kirish; kirgan
// foydalanuvchi o'z bosh sahifasiga o'tadi. Brauzerda — mobil ilova haqida ochiq sahifa (SEO, do'kon tugmalari).
async function AppIntroOrAbout() {
  if (await isAppRequest()) {
    return (
      <>
        <Suspense fallback={null}>
          <GuestOnly />
        </Suspense>
        <Intro kind="student" />
      </>
    );
  }
  return <AppAbout />;
}

export default async function AppPage({ params }: PageProps<"/[locale]/ilova">) {
  const locale = await resolveLocale(params);
  const meta = await getTranslations({ locale, namespace: "meta" });
  const t = await getTranslations({ locale, namespace: "appPage" });
  return (
    <>
      <JsonLd data={breadcrumbLd(meta("home"), { name: t("breadcrumb"), path: "/ilova" })} />
      <Suspense fallback={null}>
        <AppIntroOrAbout />
      </Suspense>
    </>
  );
}
