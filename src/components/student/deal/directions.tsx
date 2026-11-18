"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { defaultRouteMode, detectPlatform, directionsUrl, DIRECTIONS_PROVIDERS, formatDistance, type DirectionsProvider, type Platform } from "@/lib/directions";
import type { Point } from "@/lib/geo";

/** Rasmiy belgilar (o'zgartirilmagan; ilovadagi `mobile/assets/brands` bilan bir xil fayllar, manba — SOURCE.md) */
const LOGOS: Record<DirectionsProvider, string> = {
  yandex: "/brands/yandex-maps.png",
  google: "/brands/google-maps.png",
  yandexGo: "/brands/yandex-go.png",
};

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
  /** Tuman ("Chilonzor") — manzil ostida, masofa bilan */
  district?: string | null;
  /** Biznes mo'ljali ("Chilonzor metrosidan 5 daqiqa") — bo'lsa oynada ko'rsatiladi */
  landmark?: string | null;
  point: Point | null;
  /** Tanlangan joydan; noma'lum bo'lsa ko'rsatilmaydi */
  distanceKm: number | null;
  className?: string;
};

/**
 * "Borish · 6 km" tugmasi va "Qanday borasiz?" oynasi (T5 / WT3 manzil qatori, xaritadagi tanlangan joy) — ilovadagi
 * oyna bilan bir xil: manzil (tuman · masofa, mo'ljal) va "Nusxalash", pastda 3 katak — Yandex Xaritalar, Google Maps,
 * Yandex Go (rasmiy belgilar). Marshrut turi tanlanmaydi: 1 km dan yaqin — piyoda, aks holda jamoat transporti
 * (`defaultRouteMode`). Havolalar `src/lib/directions.ts` da (ilova bo'lsa ilova, bo'lmasa sayt). Dizaynda chizilmagan.
 */
export function DirectionsButton({ name, address, district = null, landmark, point, distanceKm, className }: Props) {
  const t = useTranslations("directions");
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");

  const show = () => {
    setCopied(false);
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setOpen(true);
  };

  const mode = defaultRouteMode(null, distanceKm);
  const target = { point, address };
  const options = DIRECTIONS_PROVIDERS.flatMap((p) => {
    const href = directionsUrl(p, target, platform, mode);
    return href ? [{ provider: p, href }] : [];
  });
  const sub = [district, distanceKm !== null ? formatDistance(distanceKm) : null].filter(Boolean).join(" · ");

  const copy = async () => {
    const ok = await copyText([address, district].filter(Boolean).join(", "));
    if (ok) setCopied(true);
    else toast(t("copyFailed"), "info");
  };

  return (
    <>
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={show} className={className} data-testid="directions-open">
        <Icon name="navigate" size={16} />
        {distanceKm !== null ? t("button", { distance: formatDistance(distanceKm) }) : t("buttonShort")}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("title")} closeLabel={t("close")} anchor={trigger} width={380}>
        <div className="flex flex-col gap-2.5 px-4 pb-2">
          <div className="flex items-center gap-3 rounded-18 bg-white py-3 pr-2 pl-4" data-testid="directions-place">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="sr-only">{name}</span>
              <span className="text-15 font-extrabold">{address}</span>
              {sub ? <span className="text-13 font-semibold text-muted">{sub}</span> : null}
              {landmark ? (
                <span className="text-13 font-semibold text-muted" data-testid="directions-landmark">
                  {t("landmark", { text: landmark })}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-live="polite"
              className={cn("tp-lift flex h-11 shrink-0 items-center gap-1.5 rounded-14 border-0 px-3.5 font-sans text-14 font-extrabold", copied ? "bg-green-bg text-green" : "bg-paper text-ink")}
            >
              {copied ? <Icon name="check" size={16} /> : null}
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <ul aria-label={t("options")} className="m-0 grid list-none grid-cols-3 gap-2 p-0">
            {options.map(({ provider, href }) => (
              <li key={provider}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  data-provider={provider}
                  className="tp-card flex h-full flex-col items-center gap-2.5 rounded-20 bg-white px-1.5 pt-4 pb-3.5 text-center text-ink no-underline"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- rasmiy belgi (public/brands, o'zgartirilmagan) */}
                  <img src={LOGOS[provider]} alt={t("logo", { name: t(`providers.${provider}`) })} width={52} height={52} className="block size-13 object-contain" />
                  <span className="text-13 leading-[16px] font-extrabold whitespace-pre-line">
                    {t(`cell.${provider}`)}
                    {provider === "yandexGo" ? <span className="block font-semibold text-muted">{t("taxi")}</span> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </BottomSheet>
    </>
  );
}
