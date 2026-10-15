import { useTranslations } from "next-intl";
import type { FeedDeal } from "@/lib/feed";
import type { Point } from "@/lib/geo";
import { cn } from "@/lib/cn";

const MAX_PINS = 6;

/**
 * WT2 dagi kichik xarita: dizayndagi chizma (ko'chalar, bog'), ustida eng yaqin chegirmalar o'z joyida —
 * markazga (talaba joyi) nisbatan proyeksiya. Haqiqiy xarita "Xaritada ochish" orqali.
 */
export function MiniMap({ deals, origin, onOpen }: { deals: FeedDeal[]; origin: Point | null; onOpen: () => void }) {
  const t = useTranslations("feed");
  const located = deals.filter((d): d is FeedDeal & { point: Point } => d.point !== null);
  // Bitta joyda bitta belgi (biznesning eng katta chegirmasi)
  const byBusiness = new Map<string, FeedDeal & { point: Point }>();
  for (const d of located) {
    const seen = byBusiness.get(d.businessId);
    if (!seen || d.percent > seen.percent) byBusiness.set(d.businessId, d);
  }
  const pins = [...byBusiness.values()].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)).slice(0, MAX_PINS);
  const center =
    origin ??
    (pins.length
      ? { lat: pins.reduce((s, d) => s + d.point.lat, 0) / pins.length, lng: pins.reduce((s, d) => s + d.point.lng, 0) / pins.length }
      : null);
  const cos = Math.cos(((center?.lat ?? 41.3) * Math.PI) / 180);
  const offsets = pins.map((d) => ({ d, x: (d.point.lng - (center?.lng ?? 0)) * cos, y: d.point.lat - (center?.lat ?? 0) }));
  const reach = Math.max(1e-6, ...offsets.map((o) => Math.max(Math.abs(o.x), Math.abs(o.y))));

  return (
    <div role="img" aria-label={t("miniMap")} className="relative h-[220px] overflow-hidden rounded-18 bg-map">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 47%, var(--color-paper-2) 47%, var(--color-paper-2) 53%, transparent 53%) 0 0 / 70px 100%, linear-gradient(0deg, transparent 46%, var(--color-paper-2) 46%, var(--color-paper-2) 54%, transparent 54%) 0 0 / 100% 60px",
        }}
      />
      <div aria-hidden="true" className="absolute top-[58%] -left-[10%] h-3.5 w-[130%] -rotate-[14deg] bg-white" />
      <div aria-hidden="true" className="absolute top-[10%] left-[62%] h-11 w-[60px] rounded-8 bg-map-park" />
      {origin ? (
        <span className="absolute top-[46%] left-[46%] box-content size-[18px] rounded-full border-4 border-solid border-white bg-blue shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-blue)_20%,transparent)]" />
      ) : null}
      {offsets.map(({ d, x, y }) => (
        <span
          key={d.id}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 rounded-6 px-1.5 py-[3px] text-14 font-black font-stretch-70%",
            d.live ? "bg-orange text-ink" : "bg-ink text-white",
          )}
          style={{ left: `${50 + (x / reach) * 36}%`, top: `${44 - (y / reach) * 30}%` }}
        >
          {d.badge}
        </span>
      ))}
      <button
        type="button"
        onClick={onOpen}
        className="absolute right-3 bottom-3 left-3 h-11 rounded-12 border-0 bg-ink font-sans text-14 font-bold text-white"
      >
        {t("openMap")}
      </button>
    </div>
  );
}
