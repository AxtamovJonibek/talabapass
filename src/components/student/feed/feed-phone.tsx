"use client";

import { useTranslations } from "next-intl";
import { SearchField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { formatMinute, toTashkent } from "@/lib/time";
import { BellButton, StudentBottomNav } from "../app-chrome";
import { CategoryChips } from "./category-chips";
import { FeedControls } from "./feed-controls";
import { FeedMap } from "./feed-map";
import { FeedDealCard } from "./feed-deal-card";
import { LocationSelect, type LocationProps } from "./location-select";
import type { Feed } from "./use-feed";
import type { FeedCategory } from "@/lib/feed";
import type { Point } from "@/lib/geo";

export const HOT_TONES = ["blue", "orange", "ink"] as const;

type Props = { feed: Feed; categories: FeedCategory[]; location: LocationProps & { label: string }; origin: Point | null; unread: boolean; coupons: number };

/** T4 — chegirmalar lentasi (telefon), "Lenta B · Jurnal". */
export function FeedPhone({ feed, categories, location, origin, unread, coupons }: Props) {
  const t = useTranslations();
  const now = toTashkent(feed.now);

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <header className="px-4 pt-[50px]">
          <div className="flex items-center justify-between font-mono text-11 tracking-[0.1em] text-muted uppercase">
            <span>
              {t(`weekday.long.${now.weekday}` as "weekday.long.1")} · {now.date.getUTCDate()} {t(`month.name.${now.date.getUTCMonth() + 1}` as "month.name.1")} · {formatMinute(now.minute)}
            </span>
            <LocationSelect value={location.value} districts={location.districts}>
              <span className="flex h-11 items-center gap-[5px] text-11 tracking-[0.1em] text-ink uppercase underline decoration-1 underline-offset-4">
                {location.label}
                <Icon name="chevronDown" size={12} strokeWidth={2.6} />
              </span>
            </LocationSelect>
          </div>
          <div className="flex items-end justify-between gap-3">
            <h1 className="m-0 mt-0.5 text-[50px] leading-[0.88] font-black tracking-[-0.05em] font-stretch-125%">
              {t("feed.titleTop")}
              <br />
              {t("feed.titleBottom")}
              <span className="text-orange">.</span>
            </h1>
            <div className="flex items-center gap-2 pb-1">
              <BellButton unread={unread} />
            </div>
          </div>
          <div className="mt-3.5">
            <SearchField id="t4-search" underline label={t("common.search")} placeholder={t("feed.searchPhone")} value={feed.q} onChange={(e) => feed.setQ(e.target.value)} />
          </div>
        </header>

        <div className="mt-4 py-1">
          <CategoryChips categories={categories} value={feed.category} onChange={feed.setCategory} />
        </div>

        <FeedControls feed={feed} hasOrigin={origin !== null} idPrefix="t4" className="mt-2 px-4" />

        {feed.view === "map" ? (
          <div className="px-4 pt-1 pb-24">
            <FeedMap deals={feed.items} origin={origin} now={feed.now} className="h-[max(380px,calc(100dvh-400px))]" />
          </div>
        ) : (
          <div className="flex flex-col gap-[18px] px-4 pt-3 pb-24">
            {feed.items.map((deal) => (
              <FeedDealCard key={deal.id} deal={deal} now={feed.now} />
            ))}
            {feed.items.length === 0 ? <div className="px-5 py-10 text-center text-14 text-muted">{t("feed.empty")}</div> : null}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => feed.setView(feed.view === "map" ? "list" : "map")}
        className="fixed bottom-[100px] left-1/2 z-20 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full border-0 bg-ink px-5 font-sans text-15 font-bold text-white transition-[scale,background-color] duration-150 ease-out hover:bg-ink-2 active:scale-[0.97]"
      >
        {feed.view === "map" ? null : <Icon name="map" size={18} />}
        {t(feed.view === "map" ? "feed.floatList" : "feed.floatMap")}
      </button>

      <StudentBottomNav active="home" coupons={coupons} />
    </div>
  );
}
