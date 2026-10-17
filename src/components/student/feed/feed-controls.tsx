"use client";

import { useTranslations } from "next-intl";
import { Dropdown } from "@/components/ui/dropdown";
import { TogglePill } from "@/components/ui/toggle-pill";
import { ViewSwitch } from "@/components/ui/view-switch";
import { cn } from "@/lib/cn";
import { SORTS } from "@/lib/feed";
import type { Feed } from "./use-feed";

/**
 * Lenta boshqaruvi — bitta ixcham qator (T4 va WT2): chapda soni va "Hozir ochiq", o'ngda saralash va "Ro'yxat | Xarita".
 * Tor ekranda qator gorizontal suriladi. `idPrefix` — telefon va veb DOM'da birga turadi, id'lar farqli bo'lsin.
 */
export function FeedControls({ feed, hasOrigin, idPrefix, className }: { feed: Feed; hasOrigin: boolean; idPrefix: string; className?: string }) {
  const t = useTranslations("feed");
  return (
    <div role="group" aria-label={t("filters")} className={cn("flex h-12 items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <span className="shrink-0 text-15 font-extrabold whitespace-nowrap">{t("count", { count: feed.items.length })}</span>
      <TogglePill id={`${idPrefix}-live`} pressed={feed.liveOnly} onChange={feed.setLiveOnly} label={t("liveNow")} hint={t("liveNowHint")} />
      <span className="ml-auto" />
      <Dropdown
        id={`${idPrefix}-sort`}
        size="md"
        label={t("sortLabel")}
        value={feed.sort}
        onChange={feed.setSort}
        options={SORTS.map((s) => ({ value: s, label: t(`sort.${s}`), disabled: s === "near" && !hasOrigin }))}
      />
      <ViewSwitch
        label={t("viewLabel")}
        value={feed.view}
        onChange={feed.setView}
        options={[
          { value: "list", label: t("viewList") },
          { value: "map", label: t("viewMap") },
        ]}
      />
    </div>
  );
}
