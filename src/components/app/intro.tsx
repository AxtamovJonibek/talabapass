"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { SplashScreen } from "@capacitor/splash-screen";
import { AppLead, AppLogo, AppScreen, AppTitle, BackArrow, Dots, Highlight, RoleChip, SkipLink, TopBar } from "@/components/ui/app-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";
import { PREF, readPref, writePref } from "@/lib/app-prefs";
import { isNativeApp } from "@/lib/native";
import { CardArt, GrowthArt, MainArt, NearArt, QrArt, ScannerArt } from "./intro-art";

type Kind = "student" | "business";

const SLIDES = {
  student: { art: [MainArt, CardArt, QrArt, NearArt], tones: ["orange", "green", "orange", "blue"] },
  business: { art: [GrowthArt, ScannerArt], tones: ["blue", "orange"] },
} as const;

const NEXT = {
  student: "/kirish",
  business: "/kirish?rol=biznes",
} as const;

/** `?slayd=N` — shu ekrandan boshlash (kirish ekranidagi ← oxirgi slaydga qaytaradi). */
const startSlide = () => Math.max(0, Number(new URLSearchParams(window.location.search).get("slayd") ?? 1) - 1);

/**
 * Ilova tanishtiruvi: talaba (Main, Slide2–4) va biznes (Biz1, Biz2) karuseli. Faqat Capacitor ilovasida —
 * brauzerda bosh sahifaga qaytadi. Talaba karuseli faqat birinchi ochilishda (Preferences `tp.onboarded`).
 * Slaydlar barmoq bilan suriladi (scroll-snap) yoki "Davom etish" bilan almashadi.
 */
export function Intro({ kind }: { kind: Kind }) {
  const t = useTranslations("app");
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  /** Qaysi slaydga ketyapmiz: silliq siljish tugamay turib yana bosilsa ham bitta oldinga o'tadi */
  const target = useRef(0);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const { art, tones } = SLIDES[kind];
  const last = index === art.length - 1;
  const namespace = kind === "student" ? "intro" : "bizIntro";

  useEffect(() => {
    if (!isNativeApp()) return router.replace("/");
    let cancelled = false;
    void (async () => {
      const seen = kind === "student" && (await readPref(PREF.onboarded)) === "1";
      if (cancelled) return;
      if (seen && !new URLSearchParams(window.location.search).has("slayd")) return router.replace(NEXT.student);
      setReady(true);
      SplashScreen.hide().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, router]);

  useLayoutEffect(() => {
    if (!ready || !scroller.current) return;
    const start = Math.min(startSlide(), art.length - 1);
    scroller.current.scrollLeft = start * scroller.current.clientWidth;
    target.current = start;
    setIndex(start);
  }, [ready, art.length]);

  function goTo(next: number) {
    const el = scroller.current;
    if (!el || next < 0 || next >= art.length) return;
    target.current = next;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }

  async function finish() {
    if (kind === "student") await writePref(PREF.onboarded, "1");
    router.replace(NEXT[kind]);
  }

  // Splash ostida: qaror qabul qilinguncha bo'sh fon
  if (!ready) return <div className="min-h-dvh bg-paper" />;

  const skip = (
    <SkipLink
      href={NEXT[kind]}
      replace
      onClick={(e) => {
        e.preventDefault();
        void finish();
      }}
    >
      {t("skip")}
    </SkipLink>
  );

  return (
    <AppScreen bleed>
      <TopBar className="px-6">
        {kind === "student" ? (
          <AppLogo size="lg" />
        ) : index > 0 ? (
          <BackArrow label={t("back")} onClick={() => goTo(target.current - 1)} />
        ) : (
          <BackArrow label={t("back")} href="/kirish" />
        )}
        {kind === "business" ? <RoleChip tone="business">{t("forBusiness")}</RoleChip> : null}
        {skip}
      </TopBar>

      <div
        ref={scroller}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        // Barmoq bilan surilganda maqsad ham shu slayd
        onScrollEnd={(e) => {
          target.current = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
        }}
        className="flex flex-[1_0_auto] snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {art.map((Art, i) => (
          <section
            key={i}
            aria-roledescription="slide"
            aria-label={t("intro.label", { n: i + 1, total: art.length })}
            aria-hidden={i !== index}
            className="flex w-full shrink-0 snap-center snap-always flex-col overflow-hidden px-6"
          >
            <Art />
            <AppTitle size={40} loose>
              {t.rich(`${namespace}.slides.${(i + 1) as 1}.title`, { hl: (chunks: ReactNode) => <Highlight tone={tones[i]}>{chunks}</Highlight> })}
            </AppTitle>
            <AppLead className="mt-3.5">{t(`${namespace}.slides.${(i + 1) as 1}.lead`)}</AppLead>
          </section>
        ))}
      </div>

      <div className="mt-[22px] flex flex-col gap-5 px-6">
        <Dots total={art.length} current={index} />
        <button
          type="button"
          onClick={() => (last ? void finish() : goTo(target.current + 1))}
          className={buttonClass({ variant: kind === "business" && last ? "orange" : "blue", size: "app", strong: true, block: true })}
        >
          {last ? (kind === "business" ? t("bizIntro.start") : t("start")) : t("next")}
          <Icon name="arrowRight" size={22} strokeWidth={2.4} />
        </button>
      </div>
    </AppScreen>
  );
}
