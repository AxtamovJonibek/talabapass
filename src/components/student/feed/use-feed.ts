"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { categoryCounts, endingSoon, filterDeals, sortDeals, type FeedDeal, type FeedSort } from "@/lib/feed";
import { useDealText } from "./labels";

export type FeedState = { q: string; category: string; liveOnly: boolean; sort: FeedSort };

/** Ma'lumot har daqiqada yangilanadi: "Hozir" / "Ertaga", qoldiq va "40 daq" eskirmasin. */
const REFRESH_MS = 60_000;

/** T4 va WT2 ning umumiy holati: filtrlar URL'da ham saqlanadi (chegirmadan qaytganda yo'qolmaydi). */
/** `defaultSort` — joy tanlangan bo'lsa "Eng yaqin", aks holda "Tez tugaydi" (URL'ga yozilmaydi). */
export function useFeed({ deals, initial, defaultSort, now: serverNow }: { deals: FeedDeal[]; initial: FeedState; defaultSort: FeedSort; now: string }) {
  const router = useRouter();
  const text = useDealText();
  const [q, setQ] = useState(initial.q);
  const [category, setCategory] = useState(initial.category);
  const [liveOnly, setLiveOnly] = useState(initial.liveOnly);
  const [sort, setSort] = useState<FeedSort>(initial.sort);
  const [mapOpen, setMapOpen] = useState(false);
  const now = new Date(serverNow);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category !== "all") params.set("kategoriya", category);
    if (liveOnly) params.set("ochiq", "1");
    if (sort !== defaultSort) params.set("saralash", sort);
    const search = params.size ? `?${params}` : "";
    if (search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}`);
  }, [q, category, liveOnly, sort, defaultSort]);

  const filtered = filterDeals(deals, { q, category, liveOnly }, text.category);
  return {
    now,
    q,
    setQ,
    category,
    setCategory,
    liveOnly,
    setLiveOnly,
    sort,
    setSort,
    mapOpen,
    setMapOpen,
    items: sortDeals(filtered, sort),
    counts: categoryCounts(deals),
    hot: endingSoon(deals, now),
  };
}

export type Feed = ReturnType<typeof useFeed>;
