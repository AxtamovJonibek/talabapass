"use client";

import dynamic from "next/dynamic";
import type { FeedCategory, FeedDeal, FeedSort } from "@/lib/feed";
import type { Point } from "@/lib/geo";
import { PhoneOrWeb } from "../responsive";
import { FeedPhone } from "./feed-phone";
import { FeedWeb } from "./feed-web";
import type { LocationProps } from "./location-select";
import { useFeed, type FeedState } from "./use-feed";

// MapLibre og'ir — faqat xarita ochilganda yuklanadi
const DealsMap = dynamic(() => import("./deals-map"), { ssr: false });

export type FeedScreenProps = {
  deals: FeedDeal[];
  /** Kategoriya slug'lari, tartib bilan */
  categories: FeedCategory[];
  initial: FeedState;
  defaultSort: FeedSort;
  /** Server vaqti (ISO) — sahifa yangilanganda o'zgaradi */
  now: string;
  location: LocationProps & { label: string };
  origin: Point | null;
  user: { firstName: string; initials: string; avatarUrl: string | null; savedMonth: number; unread: boolean; coupons: number };
};

/** T4 / WT2: holat bitta hook'da, ko'rinish ikkita. */
export function FeedScreen({ deals, categories, initial, defaultSort, now, location, origin, user }: FeedScreenProps) {
  const feed = useFeed({ deals, initial, defaultSort, now });
  return (
    <>
      <PhoneOrWeb
        phone={<FeedPhone feed={feed} categories={categories} location={location} unread={user.unread} coupons={user.coupons} />}
        web={<FeedWeb feed={feed} categories={categories} location={location} origin={origin} user={user} />}
      />
      {feed.mapOpen ? <DealsMap deals={feed.items} origin={origin} now={feed.now} onClose={() => feed.setMapOpen(false)} /> : null}
    </>
  );
}
