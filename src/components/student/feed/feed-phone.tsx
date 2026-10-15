"use client";

import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/chip";
import { DealCard, HotDealCard } from "@/components/ui/deal-card";
import { SearchField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { isIconName } from "@/components/ui/icons";
import { formatKm } from "@/lib/geo";
import { formatMinute, toTashkent } from "@/lib/time";
import { BellButton, StudentBottomNav } from "../app-chrome";
import { useDealText } from "./labels";
import { LocationSelect, type LocationProps } from "./location-select";
import type { Feed } from "./use-feed";

export const HOT_TONES = ["blue", "orange", "ink"] as const;

type Props = { feed: Feed; categories: string[]; location: LocationProps & { label: string }; unread: boolean };

/** T4 — chegirmalar lentasi (telefon). */
export function FeedPhone({ feed, categories, location, unread }: Props) {
  const t = useTranslations();
  const text = useDealText();
  const now = toTashkent(feed.now);
  const dist = (km: number | null) => (km !== null ? formatKm(km) : undefined);

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex flex-col gap-3 bg-paper px-4 pt-[54px] pb-2.5">
        <div className="flex items-center justify-between">
          <LocationSelect value={location.value} districts={location.districts}>
            <span className="flex h-11 items-center gap-1.5">
              <Icon name="pin" size={18} />
              <span className="text-15 font-bold">{location.label}</span>
              <Icon name="chevronDown" size={14} strokeWidth={2.4} />
            </span>
          </LocationSelect>
          <div className="flex items-center gap-2">
            <div className="rounded-20 bg-ink px-2.5 py-1.5 font-mono text-12 text-paper">
              {t(`weekday.short.${now.weekday}` as "weekday.short.1")} · {formatMinute(now.minute)}
            </div>
            <BellButton unread={unread} />
          </div>
        </div>
        <div className="flex gap-2">
          <SearchField id="t4-search" label={t("common.search")} placeholder={t("feed.searchPlaceholder")} value={feed.q} onChange={(e) => feed.setQ(e.target.value)} />
          <button
            type="button"
            aria-label={t("feed.showMap")}
            onClick={() => feed.setMapOpen(true)}
            className="flex size-12 shrink-0 items-center justify-center rounded-14 border-0 bg-ink text-white"
          >
            <Icon name="map" size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {feed.hot.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between px-4 pt-1.5">
              <h2 className="m-0 text-20 font-extrabold tracking-[-0.02em] font-stretch-112%">{t("feed.endingSoon")}</h2>
              <span className="text-13 text-muted">{t("feed.today")}</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-4 pt-2.5 pb-1">
              {feed.hot.map(({ deal, urgency }, i) => (
                <HotDealCard
                  key={deal.id}
                  href={`/chegirmalar/${deal.id}`}
                  size="phone"
                  tone={HOT_TONES[i % HOT_TONES.length]}
                  store={[deal.store, dist(deal.distanceKm)].filter(Boolean).join(" · ")}
                  big={deal.badge}
                  title={deal.title}
                  foot={text.urgency(deal, urgency)}
                  dot={urgency.kind === "closing"}
                  icon={isIconName(deal.icon) ? deal.icon : "bowl"}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="flex gap-1.5 overflow-x-auto px-4 pt-4 pb-1">
          {["all", ...categories].map((slug) => (
            <Chip key={slug} selected={feed.category === slug} count={feed.counts[slug] ?? 0} onClick={() => feed.setCategory(slug)}>
              {text.category(slug)}
            </Chip>
          ))}
        </div>

        <div className="flex flex-col gap-3 px-4 pt-3 pb-6">
          {feed.items.map((deal) => {
            const status = text.phoneStatus(deal, feed.now);
            return (
              <DealCard
                key={deal.id}
                href={`/chegirmalar/${deal.id}`}
                badge={deal.badge}
                store={deal.store}
                distance={dist(deal.distanceKm)}
                title={deal.title}
                price={deal.price ? { now: text.som(deal.price.now), old: deal.price.old ? text.som(deal.price.old) : undefined, currency: text.currency } : undefined}
                note={deal.price ? undefined : text.note(deal)}
                live={deal.live}
                status={status.status}
                when={status.when}
                left={deal.left}
                total={deal.total}
                icon={isIconName(deal.icon) ? deal.icon : "bowl"}
                tileColor={deal.tile}
                inkColor={deal.ink}
              />
            );
          })}
          {feed.items.length === 0 ? <div className="px-5 py-10 text-center text-14 text-muted">{t("feed.empty")}</div> : null}
        </div>
      </div>

      <StudentBottomNav active="home" />
    </div>
  );
}
