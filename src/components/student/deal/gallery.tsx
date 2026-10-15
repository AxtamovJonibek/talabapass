"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * T5 rasm qismi: rasmlar yonma-yon suriladi (scroll-snap), pastda "1 / 4 rasm". Ustidagi tugmalar va yorliq —
 * `children` (rasmlar ustida turadi). Rasm yo'q bo'lsa `fallback` (kategoriya ikonkasi).
 */
export function PhoneGallery({ images, ink, fallback, children }: { images: string[]; ink: string; fallback: ReactNode; children: ReactNode }) {
  const t = useTranslations("dealPage");
  const [index, setIndex] = useState(0);
  return (
    <>
      {images.length ? (
        <div
          className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        >
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili
            <img key={src} src={src} alt={t("photo", { n: i + 1 })} className="h-full w-full shrink-0 snap-start object-cover" />
          ))}
        </div>
      ) : (
        fallback
      )}
      {images.length ? (
        <div className="absolute top-[236px] left-4 rounded-6 bg-white px-2 py-1 font-mono text-11" style={{ color: ink }}>
          {t("photoCount", { n: Math.min(index + 1, images.length), total: images.length })}
        </div>
      ) : null}
      {children}
    </>
  );
}

/** WT3: katta rasm va yonida qolganlari (bosilsa almashadi). Bitta rasm bo'lsa — to'liq kenglikda. */
export function WebGallery({ images, tile, children }: { images: string[]; tile: string; children: ReactNode }) {
  const t = useTranslations("dealPage");
  const [main, setMain] = useState(0);
  const others = images.map((src, i) => ({ src, i })).filter((x) => x.i !== main);
  return (
    <div className={cn("grid gap-2.5", others.length ? "grid-cols-[3fr_1fr]" : "grid-cols-1")}>
      <div className="relative flex h-[clamp(260px,30cqw,420px)] items-center justify-center overflow-hidden rounded-22" style={{ background: tile }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili */}
        <img src={images[main]} alt={t("photo", { n: main + 1 })} className="absolute inset-0 size-full object-cover" />
        {children}
      </div>
      {others.length ? (
        <div className="flex flex-col gap-2.5">
          {others.map(({ src, i }) => (
            <button
              key={src}
              type="button"
              onClick={() => setMain(i)}
              aria-label={t("showPhoto", { n: i + 1 })}
              className="relative min-h-0 flex-1 overflow-hidden rounded-16 border-0 p-0"
              style={{ background: tile }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili */}
              <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
