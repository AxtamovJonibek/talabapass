"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import {
  defaultRouteMode,
  detectPlatform,
  directionsUrl,
  formatDistance,
  orderProviders,
  ROUTE_MODES,
  type DirectionsProvider,
  type Platform,
  type RouteMode,
} from "@/lib/directions";
import type { Point } from "@/lib/geo";
import { formatMetroDistance, nearestMetro } from "@/lib/transit/metro";

const PROVIDER_KEY = "tp:yonalish";
const MODE_KEY = "tp:yonalish-turi";

const LOGOS: Record<DirectionsProvider, string> = {
  yandex: "/brands/yandex-maps.svg",
  google: "/brands/google-maps.svg",
  yandexGo: "/brands/yandex-go.svg",
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // saqlab bo'lmasa — keyingi safar standart tanlov, xolos
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
  address: string;
  /** Biznes mo'ljali ("Chilonzor metrosidan 5 daqiqa") — bo'lsa oynada ko'rsatiladi */
  landmark?: string | null;
  point: Point | null;
  /** Tanlangan joydan; noma'lum bo'lsa ko'rsatilmaydi */
  distanceKm: number | null;
  className?: string;
};

/**
 * "Borish · 6 km" tugmasi va "Qanday boraman?" oynasi (T5 / WT3 manzil qatori, xaritadagi tanlangan joy): tepada biznes,
 * manzil, masofa, eng yaqin metro va mo'ljal; marshrut turi (mashinada / jamoat transporti / piyoda); Yandex Xaritalar,
 * Google Maps, taksi (Yandex Go), manzilni nusxalash. Havolalar `src/lib/directions.ts` da (ilova bo'lsa ilova, bo'lmasa sayt —
 * foydalanuvchiga aytilmaydi). Oxirgi tanlangan xizmat va tur eslab qolinadi. Dizaynda chizilmagan.
 */
export function DirectionsButton({ name, address, landmark, point, distanceKm, className }: Props) {
  const t = useTranslations("directions");
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string | null>(null);
  const [mode, setMode] = useState<RouteMode>(() => defaultRouteMode(null, distanceKm));
  const [platform, setPlatform] = useState<Platform>("desktop");

  const show = () => {
    setRecent(read(PROVIDER_KEY));
    setMode(defaultRouteMode(read(MODE_KEY), distanceKm));
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setOpen(true);
  };

  const pickMode = (next: RouteMode) => {
    setMode(next);
    write(MODE_KEY, next);
  };

  const target = { point, address };
  const options = orderProviders(recent).flatMap((p) => {
    const href = directionsUrl(p, target, platform, mode);
    return href ? [{ provider: p, href }] : [];
  });
  const metro = point ? nearestMetro(point) : null;

  const copy = async () => {
    const ok = await copyText([name, address].join(", "));
    setOpen(false);
    toast(ok ? t("copied") : t("copyFailed"), ok ? "ok" : "info");
  };

  const row = "tp-row flex min-h-13 items-center gap-3 rounded-14 bg-white px-3 py-2 text-ink no-underline";
  return (
    <>
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={show} className={className} data-testid="directions-open">
        <Icon name="navigate" size={15} strokeWidth={2.4} />
        {distanceKm !== null ? t("button", { distance: formatDistance(distanceKm) }) : t("buttonShort")}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        closeLabel={t("close")}
        anchor={trigger}
        width={380}
        description={
          <span className="flex flex-col gap-1 text-ink" data-testid="directions-place">
            <span className="text-15 font-bold">{name}</span>
            <span className="text-13 text-muted">{address}</span>
            {distanceKm !== null || metro ? (
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-13 font-semibold">
                {distanceKm !== null ? <span>{t("away", { distance: formatDistance(distanceKm) })}</span> : null}
                {metro ? <span data-testid="directions-metro">{t("metro", { station: metro.name, distance: formatMetroDistance(metro.km) })}</span> : null}
              </span>
            ) : null}
            {landmark ? <span className="text-13 text-muted" data-testid="directions-landmark">{t("landmark", { text: landmark })}</span> : null}
          </span>
        }
      >
        <div className="flex flex-col gap-3 px-4 pb-2">
          <div role="radiogroup" aria-label={t("modeLabel")} className="flex flex-wrap gap-1.5">
            {ROUTE_MODES.map((m) => (
              <Chip key={m} selected={mode === m} role="radio" aria-checked={mode === m} aria-pressed={undefined} size="sm" onClick={() => pickMode(m)}>
                {t(`modes.${m}`)}
              </Chip>
            ))}
          </div>
          <ul aria-label={t("options")} className="m-0 flex list-none flex-col gap-1.5 p-0">
            {options.map(({ provider, href }) => (
              <li key={provider}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    write(PROVIDER_KEY, provider);
                    setOpen(false);
                  }}
                  data-provider={provider}
                  className={row}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-10 border-hair border-line-soft bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- kichik SVG logotip, optimallashtirish kerak emas */}
                    <img src={LOGOS[provider]} alt="" width={provider === "yandexGo" ? 36 : 22} height={provider === "yandexGo" ? 36 : 22} className="block" />
                  </span>
                  <span className="flex-1 text-15 font-bold">{t(`providers.${provider}`)}</span>
                  {provider === recent ? <span className="rounded-6 bg-info-bg px-1.5 py-[3px] text-11 font-bold text-blue">{t("recent")}</span> : null}
                </a>
              </li>
            ))}
            <li>
              <button type="button" onClick={copy} className={`${row} w-full text-left font-sans`}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-10 bg-surface">
                  <Icon name="copy" size={18} strokeWidth={2.2} />
                </span>
                <span className="flex-1 text-15 font-bold">{t("copy")}</span>
              </button>
            </li>
          </ul>
        </div>
      </BottomSheet>
    </>
  );
}
