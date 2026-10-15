import { Suspense } from "react";
import { connection } from "next/server";
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
import { resolveLocale } from "@/i18n/locale";
import { landingDeals, landingPartners, landingStats } from "@/server/landing";

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
  return <Stats stats={await landingStats(new Date())} />;
}

// W1 / W1m — bosh sahifa. `containerType` dizayndagi cqw o'lchamlari uchun shart.
export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  await resolveLocale(params);

  return (
    <div className="dz" style={{ containerType: "inline-size", background: "var(--color-paper)", fontFamily: "var(--font-sans)", color: "var(--color-ink)", overflowX: "hidden" }}>
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
