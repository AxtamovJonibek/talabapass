import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { ForBusiness } from "@/components/landing/for-business";
import { ForStudents } from "@/components/landing/for-students";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LiveDeals } from "@/components/landing/live-deals";
import { Partners } from "@/components/landing/partners";
import { Stats } from "@/components/landing/stats";
import { Ticker } from "@/components/landing/ticker";
import { AppLandingRedirect } from "@/components/pwa/native-app";
import { JsonLd } from "@/components/seo/json-ld";
import { resolveLocale } from "@/i18n/locale";
import { organizationLd, pageMetadata, websiteLd } from "@/lib/seo";
import { landingDeals, landingPartners, landingStatsSection } from "@/server/landing";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ title: t("title"), description: t("description"), path: "/" });
}

// Bazadan keladigan bo'limlar so'rov vaqtida hisoblanadi (o'z Suspense chegarasida) — sahifaning qolgani statik.
async function LiveDealsSection() {
  await connection();
  const now = new Date();
  return <LiveDeals items={await landingDeals(now)} now={now} />;
}

async function PartnersSection() {
  await connection();
  return <Partners {...await landingPartners()} />;
}

async function StatsSection() {
  await connection();
  const section = await landingStatsSection(new Date());
  return section ? <Stats stats={section.stats} force={section.force} /> : null;
}

// W1 / W1m — bosh sahifa. `containerType` dizayndagi cqw o'lchamlari uchun shart.
export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  await resolveLocale(params);

  return (
    <div className="dz" style={{ containerType: "inline-size", background: "var(--color-paper)", fontFamily: "var(--font-sans)", color: "var(--color-ink)", overflowX: "hidden" }}>
      {/* Capacitor ilovasida landing o'rniga /ilova (brauzerda hech narsa qilmaydi) */}
      <AppLandingRedirect />
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <LandingHeader />
      <Hero />
      <Ticker />
      <HowItWorks />
      <ForStudents />
      <Suspense fallback={null}>
        <LiveDealsSection />
      </Suspense>
      <ForBusiness />
      <Suspense fallback={null}>
        <PartnersSection />
      </Suspense>
      <Suspense fallback={null}>
        <StatsSection />
      </Suspense>
      <Faq />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
