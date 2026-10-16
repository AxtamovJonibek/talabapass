"use client";

import { useTranslations } from "next-intl";
import { SearchField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { formatMinute, toTashkent } from "@/lib/time";
import { BellButton, StudentBottomNav } from "../app-chrome";
import { CategoryChips } from "./category-chips";
import { FeedDealCard } from "./feed-deal-card";
import { LocationSelect, type LocationProps } from "./location-select";
import type { Feed } from "./use-feed";
import type { FeedCategory } from "@/lib/feed";

export const HOT_TONES = ["blue", "orange", "ink"] as const;

type Props = { feed: Feed; categories: FeedCategory[]; location: LocationProps & { label: string }; unread: boolean; coupons: number };

/** T4 — chegirmalar lentasi (telefon), "Lenta B · Jurnal". */
export function FeedPhone({ feed, categories, location, unread, coupons }: Props) {
  const t = useTranslations();
  const now = toTashkent(feed.now);
  const open = feed.items.filter((d) => d.live).length;

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
              <button
                type="button"
                aria-label={t("feed.showMap")}
                onClick={() => feed.setMapOpen(true)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full border-0 bg-ink text-white"
              >
                <Icon name="map" size={20} />
              </button>
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

        <div className="flex justify-between px-4 pt-3 font-mono text-11 tracking-[0.08em] text-muted uppercase">
          <span>{t("feed.countLine", { count: feed.items.length, open })}</span>
          <span>{t(`feed.sortTag.${feed.sort}`)}</span>
        </div>

        <div className="flex flex-col gap-[18px] px-4 pt-3 pb-7">
          {feed.items.map((deal) => (
            <FeedDealCard key={deal.id} deal={deal} now={feed.now} />
          ))}
          {feed.items.length === 0 ? <div className="px-5 py-10 text-center text-14 text-muted">{t("feed.empty")}</div> : null}
        </div>
      </div>

      <StudentBottomNav active="home" coupons={coupons} />
    </div>
  );
}
