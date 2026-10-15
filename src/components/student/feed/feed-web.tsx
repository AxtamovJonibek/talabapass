"use client";

import { useTranslations } from "next-intl";
import { DealTile, HotDealCard } from "@/components/ui/deal-card";
import { SearchField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { isIconName } from "@/components/ui/icons";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { SORTS, isFeedSort } from "@/lib/feed";
import { formatSom } from "@/lib/format";
import { formatKm, type Point } from "@/lib/geo";
import { formatMinute, toTashkent } from "@/lib/time";
import { BellButton, StudentWebHeader } from "../app-chrome";
import { HOT_TONES } from "./feed-phone";
import { useDealText } from "./labels";
import { LocationSelect, type LocationProps } from "./location-select";
import { MiniMap } from "./mini-map";
import type { Feed } from "./use-feed";

type Props = {
  feed: Feed;
  categories: string[];
  location: LocationProps & { label: string };
  origin: Point | null;
  user: { firstName: string; initials: string; savedMonth: number; unread: boolean };
};

/** WT2 — chegirmalar (veb). */
export function FeedWeb({ feed, categories, location, origin, user }: Props) {
  const t = useTranslations();
  const text = useDealText();
  const now = toTashkent(feed.now);
  const dist = (km: number | null) => (km !== null ? formatKm(km) : undefined);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <StudentWebHeader sticky initials={user.initials}>
        <nav aria-label={t("feed.nav")} className="hidden gap-0.5 whitespace-nowrap @min-[1000px]:flex">
          <Link href="/chegirmalar" aria-current="page" className="flex h-10 items-center rounded-10 bg-ink px-3 text-14 font-bold text-white no-underline">
            {t("feed.navDeals")}
          </Link>
          <Link href="/kuponlar" className="flex h-10 items-center rounded-10 px-3 text-14 font-semibold text-ink no-underline">
            {t("feed.navCoupons")}
          </Link>
          <Link href="/tarix" className="flex h-10 items-center rounded-10 px-3 text-14 font-semibold text-ink no-underline">
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

      <div className="mx-auto max-w-[1360px] px-[clamp(16px,3cqw,40px)] pt-7 pb-[60px]">
        <div className="flex flex-wrap items-end justify-between gap-3.5">
          <div>
            <div className="text-15 text-muted">
              {t("feed.headline", { weekday: t(`weekday.long.${now.weekday}` as "weekday.long.1"), time: formatMinute(now.minute), place: location.label })}
            </div>
            <h1 className="mt-1 mb-0 text-[clamp(34px,4cqw,52px)] leading-none font-black tracking-[-0.04em] font-stretch-112%">
              {t("feed.greeting", { name: user.firstName })}
            </h1>
          </div>
          <Link href="/tarix" className="flex items-center gap-3 rounded-16 bg-ink px-4 py-2.5 text-paper no-underline">
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

        <div className="mt-7 flex flex-wrap items-start gap-6">
          <aside aria-label={t("feed.filters")} className="flex min-w-0 flex-[1_1_250px] flex-col gap-3">
            <div className="rounded-18 bg-white p-4">
              <div className="text-12 font-extrabold tracking-[0.08em] text-muted">{t("feed.category")}</div>
              <ul className="m-0 mt-2 flex list-none flex-col gap-0.5 p-0">
                {["all", ...categories].map((slug) => {
                  const on = feed.category === slug;
                  return (
                    <li key={slug}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => feed.setCategory(slug)}
                        className={cn(
                          "flex h-[42px] w-full items-center justify-between rounded-10 border-0 px-3 font-sans text-15 font-semibold",
                          on ? "bg-ink text-white" : "bg-transparent text-ink",
                        )}
                      >
                        <span>{text.category(slug)}</span>
                        <span className="font-mono text-12 opacity-75">{feed.counts[slug] ?? 0}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-18 bg-white p-4">
              <span className="flex flex-col gap-0.5">
                <b className="text-15">{t("feed.liveOnly")}</b>
                <span className="text-13 text-muted">{t("feed.liveOnlyHint")}</span>
              </span>
              <Switch id="wt2-live" checked={feed.liveOnly} onChange={feed.setLiveOnly} label={t("feed.liveOnly")} />
            </div>
            <MiniMap deals={feed.items} origin={origin} onOpen={() => feed.setMapOpen(true)} />
          </aside>

          <section className="min-w-0 flex-[4_1_600px]">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h2 className="m-0 text-22 font-extrabold">
                {t("feed.count", { count: feed.items.length })} <span className="font-medium text-muted">{t(`feed.sortHint.${feed.sort}`)}</span>
              </h2>
              <label className="flex items-center gap-2 text-14 text-muted">
                {t("feed.sortLabel")}
                <select
                  id="wt2-sort"
                  value={feed.sort}
                  onChange={(e) => isFeedSort(e.target.value) && feed.setSort(e.target.value)}
                  className="h-[42px] rounded-10 border-hair border-line bg-white px-2.5 font-sans text-14 text-ink"
                >
                  {SORTS.map((s) => (
                    <option key={s} value={s} disabled={s === "near" && !origin}>
                      {t(`feed.sort.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-3">
              {feed.items.map((deal) => (
                <DealTile
                  key={deal.id}
                  href={`/chegirmalar/${deal.id}`}
                  badge={deal.badge}
                  store={deal.store}
                  distance={dist(deal.distanceKm)}
                  title={deal.title}
                  price={deal.price ? `${text.som(deal.price.now)} ${text.currency}` : text.note(deal, true)}
                  old={deal.price?.old ? text.som(deal.price.old) : null}
                  live={deal.live}
                  status={text.webStatus(deal, feed.now)}
                  left={deal.left}
                  total={deal.total}
                  icon={isIconName(deal.icon) ? deal.icon : "bowl"}
                  image={deal.images[0]}
                  tileColor={deal.tile}
                  inkColor={deal.ink}
                />
              ))}
            </div>
            {feed.items.length === 0 ? <div className="mt-3.5 rounded-18 bg-white p-10 text-center text-muted">{t("feed.emptyFilter")}</div> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
