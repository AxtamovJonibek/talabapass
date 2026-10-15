"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DealCard } from "@/components/ui/deal-card";
import { Icon } from "@/components/ui/icon";
import { isIconName } from "@/components/ui/icons";
import type { FeedDeal } from "@/lib/feed";
import { formatKm, type Point } from "@/lib/geo";
import { formatSom } from "@/lib/format";
import { useDealText } from "./labels";

/** Ochiq vektor xarita (kalitsiz). Uslub OpenStreetMap ma'lumotlari asosida, atributsiya xaritaning o'zida. */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const TASHKENT: [number, number] = [69.2797, 41.3111];

// Belgilar DOM orqali yaratiladi — klasslar shu yerda to'liq yozilgan (Tailwind ularni topishi uchun)
const PIN_LIVE = "cursor-pointer rounded-6 border-0 bg-orange px-1.5 py-[3px] font-sans text-14 font-black text-ink font-stretch-70%";
const PIN_LATER = "cursor-pointer rounded-6 border-0 bg-ink px-1.5 py-[3px] font-sans text-14 font-black text-white font-stretch-70%";
const PIN_SELECTED = "outline-2 outline-offset-2 outline-ink outline-solid";
const ME = "box-content size-[18px] rounded-full border-4 border-solid border-white bg-blue shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-blue)_20%,transparent)]";

/**
 * To'liq ekran xarita (T4 "Xaritada ko'rish", WT2 "Xaritada ochish"). Dizaynda chizilmagan — mavjud
 * primitivlardan: yorliqlar kartadagi belgi uslubida, tanlangani pastda T4 kartasi bilan.
 */
export default function DealsMap({ deals, origin, now, onClose }: { deals: FeedDeal[]; origin: Point | null; now: Date; onClose: () => void }) {
  const t = useTranslations("feed");
  const text = useDealText();
  const box = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const located = deals.filter((d): d is FeedDeal & { point: Point } => d.point !== null);
  const ids = located.map((d) => d.id).join(",");

  useEffect(() => {
    if (!box.current) return;
    const map = new maplibregl.Map({
      container: box.current,
      style: MAP_STYLE,
      center: origin ? [origin.lng, origin.lat] : TASHKENT,
      zoom: 12,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const markers: maplibregl.Marker[] = [];
    const bounds = new maplibregl.LngLatBounds();
    for (const d of located) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = d.live ? PIN_LIVE : PIN_LATER;
      el.textContent = d.badge;
      el.setAttribute("aria-label", `${d.store}: ${d.title}`);
      el.dataset.id = d.id;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(d.id);
      });
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([d.point.lng, d.point.lat]).addTo(map));
      bounds.extend([d.point.lng, d.point.lat]);
    }
    if (origin) {
      const me = document.createElement("span");
      me.className = ME;
      markers.push(new maplibregl.Marker({ element: me }).setLngLat([origin.lng, origin.lat]).addTo(map));
      bounds.extend([origin.lng, origin.lat]);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
    map.on("click", () => setSelected(null));

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
    // Belgilar faqat ro'yxat o'zgarganda qayta chiziladi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, origin?.lat, origin?.lng]);

  useEffect(() => {
    box.current?.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => {
      for (const c of PIN_SELECTED.split(" ")) el.classList.toggle(c, el.dataset.id === selected);
    });
  }, [selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const deal = located.find((d) => d.id === selected);
  const status = deal ? text.phoneStatus(deal, now) : null;

  return (
    <div role="dialog" aria-modal="true" aria-label={t("map.title")} className="fixed inset-0 z-50 flex flex-col bg-paper text-ink">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button type="button" onClick={onClose} aria-label={t("map.close")} className="flex size-11 items-center justify-center rounded-full border-0 bg-white text-ink">
          <Icon name="close" size={20} />
        </button>
        <h2 className="m-0 text-20 font-extrabold tracking-[-0.02em] font-stretch-112%">{t("map.title")}</h2>
        <span className="ml-auto font-mono text-12 text-muted">{located.length}</span>
      </div>
      <div className="relative flex-1">
        <div ref={box} className="absolute inset-0" />
        {located.length === 0 ? (
          <div className="absolute inset-x-4 top-4 rounded-14 bg-white p-4 text-center text-14 text-muted">{t("map.nothing")}</div>
        ) : null}
        {deal && status ? (
          <div className="absolute inset-x-4 bottom-6 mx-auto max-w-[420px]">
            <DealCard
              href={`/chegirmalar/${deal.id}`}
              badge={deal.badge}
              store={deal.store}
              distance={deal.distanceKm !== null ? formatKm(deal.distanceKm) : undefined}
              title={deal.title}
              price={deal.price ? { now: formatSom(deal.price.now), old: deal.price.old ? formatSom(deal.price.old) : undefined, currency: text.currency } : undefined}
              note={deal.price ? undefined : text.note(deal)}
              live={deal.live}
              status={status.status}
              when={status.when}
              left={deal.left}
              total={deal.total}
              icon={isIconName(deal.icon) ? deal.icon : "bowl"}
              image={deal.images[0]}
              tileColor={deal.tile}
              inkColor={deal.ink}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
