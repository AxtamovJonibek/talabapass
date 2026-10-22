"use client";

import { useTranslations } from "next-intl";
import { HotDealCard } from "@/components/ui/deal-card";
import { SearchField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { isIconName } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { formatSom } from "@/lib/format";
import { formatKm, type Point } from "@/lib/geo";
import { formatMinute, toTashkent } from "@/lib/time";
import { BellButton, StudentWebHeader } from "../app-chrome";
import { HOT_TONES } from "./feed-phone";
import { useDealText } from "./labels";
import { LocationSelect, type LocationProps } from "./location-select";
import { CategoryChips } from "./category-chips";
import { FeedControls } from "./feed-controls";
import { FeedMap } from "./feed-map";
import { FeedDealCard } from "./feed-deal-card";
import type { FeedCategory } from "@/lib/feed";
import type { Feed } from "./use-feed";

type Props = {
  feed: Feed;
  categories: FeedCategory[];
  location: LocationProps & { label: string };
  origin: Point | null;
  user: { firstName: string; initials: string; avatarUrl: string | null; savedMonth: number; unread: boolean; coupons: number };
};

/** WT2 — chegirmalar (veb). */
export function FeedWeb({ feed, categories, location, origin, user }: Props) {
  const t = useTranslations();
  const text = useDealText();
  const now = toTashkent(feed.now);
  const dist = (km: number | null) => (km !== null ? formatKm(km) : undefined);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <StudentWebHeader sticky initials={user.initials} avatarUrl={user.avatarUrl}>
        <nav aria-label={t("feed.nav")} className="hidden gap-0.5 whitespace-nowrap @min-[1000px]:flex">
          <Link href="/chegirmalar" aria-current="page" className="tp-lift flex h-10 items-center rounded-10 bg-ink px-3 text-14 font-bold text-white no-underline">
            {t("feed.navDeals")}
          </Link>
          <Link href="/kuponlar" className="tp-row flex h-10 items-center rounded-10 px-3 text-14 font-semibold text-ink no-underline">
            {t("feed.navCoupons")}
          </Link>
          <Link href="/tarix" className="tp-row flex h-10 items-center rounded-10 px-3 text-14 font-semibold text-ink no-underline">
            {t("feed.navHistory")}
          </Link>
        </nav>
        <SearchField id="wt2-search" size="sm" label={t("common.search")} placeholder={t("feed.searchPlaceholder")} value={feed.q} onChange={(e) => feed.setQ(e.target.value)} />
        <LocationSelect value={location.value} districts={location.districts} className="hidden shrink-0 @min-[760px]:block">
          <span className="flex h-[46px] max-w-[300px] items-center gap-1.5 overflow-hidden rounded-14 bg-white px-3 text-14 font-bold whitespace-nowrap">
            <Icon name="pin" size={16} />
            {location.label}
          </span>
        </LocationSelect>
        <BellButton unread={user.unread} size="lg" />
      </StudentWebHeader>

      <div className="mx-auto max-w-[1560px] px-[clamp(16px,3cqw,40px)] pt-7 pb-[60px]">
        <div className="flex flex-wrap items-end justify-between gap-3.5">
          <div>
            <div className="text-15 text-muted">
              {t("feed.headline", { weekday: t(`weekday.long.${now.weekday}` as "weekday.long.1"), time: formatMinute(now.minute), place: location.label })}
            </div>
            <h1 className="mt-1 mb-0 text-[clamp(34px,4cqw,52px)] leading-none font-black tracking-[-0.04em] font-stretch-112%">
              {t("feed.greeting", { name: user.firstName })}
            </h1>
          </div>
          <Link href="/tarix" className="tp-lift flex items-center gap-3 rounded-16 bg-ink px-4 py-2.5 text-paper no-underline">
            <span className="text-13 text-fog-2">{t("feed.savedMonth", { month: t(`month.in.${now.date.getUTCMonth() + 1}` as "month.in.1") })}</span>
            <b className="text-22 font-black font-stretch-85%">
              {formatSom(user.savedMonth)} {text.currency}
            </b>
          </Link>
        </div>

        {feed.hot.length > 0 ? (
          <div className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3">
            {feed.hot.map(({ deal, urgency }, i) => (
              <HotDealCard
                key={deal.id}
                href={`/chegirmalar/${deal.id}`}
                size="web"
                tone={HOT_TONES[i % HOT_TONES.length]}
                store={[deal.store, dist(deal.distanceKm)].filter(Boolean).join(" · ")}
                big={deal.badge}
                title={deal.title}
                foot={text.urgency(deal, urgency, true)}
                dot={urgency.kind === "closing"}
                icon={isIconName(deal.icon) ? deal.icon : "bowl"}
              />
            ))}
          </div>
        ) : null}

        <section className="mt-7 min-w-0">
          <CategoryChips categories={categories} value={feed.category} onChange={feed.setCategory} inset="px-6" className="-mx-6" />
          <FeedControls feed={feed} hasOrigin={origin !== null} idPrefix="wt2" className="mt-3.5" />
          {feed.view === "map" ? (
            <FeedMap deals={feed.items} origin={origin} now={feed.now} className="mt-3.5 h-[max(520px,calc(100dvh-280px))]" />
          ) : (
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-x-8 gap-y-8">
              {feed.items.map((deal) => (
                <FeedDealCard key={deal.id} deal={deal} now={feed.now} />
              ))}
            </div>
          )}
          {feed.view === "list" && feed.items.length === 0 ? <div className="mt-3.5 rounded-18 bg-white p-10 text-center text-muted">{t("feed.emptyFilter")}</div> : null}
        </section>
      </div>
    </div>
  );
}
