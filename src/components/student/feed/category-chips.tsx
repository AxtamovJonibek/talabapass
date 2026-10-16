"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CategoryPill } from "@/components/ui/category-pill";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { FeedCategory } from "@/lib/feed";
import { useDealText } from "./labels";

type Props = {
  categories: FeedCategory[];
  value: string;
  onChange: (slug: string) => void;
  /** Yon bo'sh joy: telefonda qator ekran chetigacha chiqadi */
  inset?: string;
};

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

const ALL: FeedCategory = { slug: "all", icon: "all", tile: "var(--color-white)", ink: "var(--color-ink)" };

/** Sekin aylanish tezligi (px/s) */
const SPEED = 24;
/** Barmoq/sichqoncha tugmalari bir bosishda suradigan masofa */
const STEP = 220;

/**
 * Kategoriya chiplari karuseli: o'zi sekin aylanadi (bir xil nusxa ketma-ket, cheksiz). Tegish, hover, g'ildirak, fokus yoki
 * surish bo'lsa to'xtaydi va qayta aylanmaydi — nusxa olib tashlanadi, qator oddiy surish bo'ladi. Kursorli qurilmada ← → tugmalari.
 * `prefers-reduced-motion` bo'lsa umuman aylanmaydi.
 */
export function CategoryChips({ categories, value, onChange, inset = "px-4" }: Props) {
  const t = useTranslations("feed");
  const text = useDealText();
  const scroller = useRef<HTMLDivElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const [stoppedByUser, setStoppedByUser] = useState(false);
  const looping = !reduced && !stoppedByUser;
  const [edges, setEdges] = useState({ start: true, end: false });
  const list = [ALL, ...categories];

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (reduced) return;
    const chips = () => el.querySelectorAll<HTMLElement>("button[data-chip]");
    /** Bir nusxaning kengligi (chiplar + oraliq) */
    const period = () => {
      const all = chips();
      return all.length > list.length ? all[list.length].offsetLeft - all[0].offsetLeft : 0;
    };
    let raf = 0;
    let stopped = false;
    let pos = el.scrollLeft;
    let written = pos;
    let last = performance.now();

    const tick = (now: number) => {
      const p = period();
      if (p > 0) {
        pos += (SPEED * Math.min(now - last, 100)) / 1000;
        if (pos >= p) pos -= p;
        written = pos;
        el.scrollLeft = pos;
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      const p = period();
      // Nusxa olib tashlanganda ko'rinish o'zgarmasin: ikkinchi nusxadagi joy birinchisiga ko'chiriladi
      if (p > 0) el.scrollLeft = el.scrollLeft % p;
      setStoppedByUser(true);
    };
    stopRef.current = stop;
    // Avtomatik surishdan boshqa har qanday siljish — foydalanuvchi qo'li
    const onScroll = () => {
      if (!stopped && Math.abs(el.scrollLeft - written) > 2) stop();
    };
    const events = ["pointerenter", "pointerdown", "touchstart", "wheel", "focusin", "keydown"] as const;
    events.forEach((e) => el.addEventListener(e, stop, { passive: true }));
    el.addEventListener("scroll", onScroll, { passive: true });
    // Sahifa (yoki lenta) siljiganda ham to'xtaydi; qatorning o'z siljishi bu yerga kirmaydi
    const onPageScroll = (e: Event) => {
      if (e.target !== el) stop();
    };
    document.addEventListener("scroll", onPageScroll, { capture: true, passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((e) => el.removeEventListener(e, stop));
      el.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onPageScroll, { capture: true });
    };
  }, [list.length, reduced]);

  const measure = () => {
    const el = scroller.current;
    if (el) setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [looping]);

  const nudge = (dir: 1 | -1) => {
    stopRef.current();
    // Nusxa olib tashlangach (keyingi kadr) siljitiladi
    requestAnimationFrame(() => scroller.current?.scrollBy({ left: dir * STEP, behavior: "smooth" }));
  };

  const arrow = "absolute top-1/2 z-[1] hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border-hair border-line bg-white text-ink disabled:opacity-0 [@media(pointer:fine)]:flex";

  return (
    <div className="relative">
      <div ref={scroller} role="group" aria-label={t("categories")} onScroll={measure} className={cn("relative flex gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", inset)}>
        {list.map((c) => (
          <CategoryPill key={c.slug} data-chip selected={value === c.slug} label={text.category(c.slug)} icon={c.icon} tileColor={c.tile} inkColor={c.ink} onClick={() => onChange(c.slug)} />
        ))}
        {looping
          ? list.map((c) => (
              <CategoryPill key={`copy-${c.slug}`} data-chip aria-hidden tabIndex={-1} selected={value === c.slug} label={text.category(c.slug)} icon={c.icon} tileColor={c.tile} inkColor={c.ink} onClick={() => onChange(c.slug)} />
            ))
          : null}
      </div>
      <button type="button" aria-label={t("chipsPrev")} disabled={!looping && edges.start} onClick={() => nudge(-1)} className={cn(arrow, "left-1")}>
        <Icon name="chevronLeft" size={18} strokeWidth={2.4} />
      </button>
      <button type="button" aria-label={t("chipsNext")} disabled={!looping && edges.end} onClick={() => nudge(1)} className={cn(arrow, "right-1")}>
        <Icon name="chevronRight" size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}
