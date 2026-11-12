"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { detectPlatform, directionsUrl, orderProviders, type DirectionsProvider, type Platform } from "@/lib/directions";
import { formatKm, type Point } from "@/lib/geo";

const STORAGE_KEY = "tp:yonalish";

const LOGOS: Record<DirectionsProvider, string> = {
  yandex: "/brands/yandex-maps.svg",
  google: "/brands/google-maps.svg",
  dgis: "/brands/2gis.svg",
  yandexGo: "/brands/yandex-go.svg",
};

function readRecent(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRecent(provider: DirectionsProvider) {
  try {
    localStorage.setItem(STORAGE_KEY, provider);
  } catch {
    // saqlab bo'lmasa — tartib o'zgarmaydi, xolos
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Eski brauzer yoki ruxsatsiz kontekst: vaqtinchalik maydon orqali
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

type Props = {
  name: string;
  /** To'liq manzil (mo'ljal bilan) — sarlavha ostida va nusxalash uchun */
  address: string;
  point: Point | null;
  /** Tanlangan joydan to'g'ri chiziq bo'yicha; noma'lum bo'lsa ko'rsatilmaydi */
  distanceKm: number | null;
  className?: string;
  children: ReactNode;
};

/**
 * "Yo'l ko'rsatish" (T5 / WT3 manzil qatori, xaritadagi tanlangan joy): tugma `BottomSheet` ochadi — Yandex Xaritalar,
 * Google Maps, 2GIS, Yandex Go va manzilni nusxalash. Havolalar `src/lib/directions.ts` da (ilova bo'lsa ilova,
 * bo'lmasa sayt). Oxirgi tanlangan variant tepada, "Oxirgi ishlatilgan" belgisi bilan. Dizaynda chizilmagan.
 */
export function DirectionsButton({ name, address, point, distanceKm, className, children }: Props) {
  const t = useTranslations("directions");
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>("desktop");

  const show = () => {
    setRecent(readRecent());
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setOpen(true);
  };

  const target = { point, address };
  const options = orderProviders(recent).flatMap((p) => {
    const href = directionsUrl(p, target, platform);
    return href ? [{ provider: p, href }] : [];
  });

  const copy = async () => {
    const ok = await copyText([name, address].join(", "));
    setOpen(false);
    toast(ok ? t("copied") : t("copyFailed"), ok ? "ok" : "info");
  };

  return (
    <>
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={show} className={className}>
        {children}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        closeLabel={t("close")}
        anchor={trigger}
        width={400}
        description={
          <span className="flex flex-col items-start gap-2">
            <span>{address}</span>
            {distanceKm !== null ? (
              <span className="rounded-8 bg-surface px-2 py-1 font-mono text-11 font-bold tracking-[0.08em] text-ink uppercase">
                {t("distance", { km: formatKm(distanceKm) })}
              </span>
            ) : null}
          </span>
        }
      >
        <ul aria-label={t("options")} className="m-0 flex list-none flex-col gap-2 px-4 pt-1 pb-2">
          {options.map(({ provider, href }) => (
            <li key={provider}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  writeRecent(provider);
                  setOpen(false);
                }}
                data-provider={provider}
                className="tp-row flex min-h-16 items-center gap-3.5 rounded-16 bg-white px-3.5 py-3 text-ink no-underline"
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-12 border-hair border-line-soft bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- kichik SVG logotip, optimallashtirish kerak emas */}
                  <img src={LOGOS[provider]} alt="" width={provider === "yandexGo" ? 44 : 26} height={provider === "yandexGo" ? 44 : 26} className="block" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                  {provider === recent ? (
                    <span className="mb-0.5 rounded-6 bg-info-bg px-1.5 py-[3px] font-mono text-10 font-bold tracking-[0.08em] text-blue uppercase">{t("recent")}</span>
                  ) : null}
                  <span className="text-16 font-bold">{t(`providers.${provider}`)}</span>
                  <span className="text-13 text-muted">{t(provider === "yandexGo" ? "taxiHint" : "mapHint")}</span>
                </span>
                <Icon name="chevronRight" size={18} strokeWidth={2.2} className="shrink-0 text-placeholder" />
              </a>
            </li>
          ))}
          <li>
            <button type="button" onClick={copy} className="tp-row flex min-h-16 w-full items-center gap-3.5 rounded-16 bg-white px-3.5 py-3 text-left font-sans text-ink">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-12 bg-surface">
                <Icon name="copy" size={20} strokeWidth={2.2} />
              </span>
              <span className="flex-1 text-16 font-bold">{t("copy")}</span>
            </button>
          </li>
        </ul>
      </BottomSheet>
    </>
  );
}
