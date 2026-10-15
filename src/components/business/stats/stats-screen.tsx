import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Period } from "@/lib/stats";
import { formatMinute, toTashkent, weekdayOf } from "@/lib/time";
import type { BusinessStats } from "@/server/business/stats";
import { OwnerFrame } from "../owner-pages";
import { CashierBars, Funnel, Heatmap, Kpis, OffersTable, RecentSales, SalesChart, Universities } from "./blocks";
import { LiveRefresh } from "./live-refresh";
import { PeriodTabs } from "./period-tabs";

/** Sarlavha: sana, "Statistika", davr tanlovi va Excel. Telefonda sarlavha kichikroq, tugmalar pastda. */
export function StatsHeader({ now, period, title, phone = false, children }: { now: Date; period: Period; title: string; phone?: boolean; children?: ReactNode }) {
  const t = useTranslations("businessStats");
  const w = useTranslations("weekday.long");
  const m = useTranslations("month.name");
  const local = toTashkent(now);
  const date = t("dateLine", {
    weekday: w(String(weekdayOf(local.date)) as "1"),
    day: local.date.getUTCDate(),
    month: m(String(local.date.getUTCMonth() + 1) as "1"),
    time: formatMinute(local.minute),
  });
  return (
    <header className="flex flex-wrap items-end justify-between gap-3.5">
      <div>
        <div className="text-13 text-muted">{date}</div>
        <h1 className={phone ? "m-0 mt-1 text-28 leading-none font-black tracking-[-0.035em] font-stretch-112%" : "m-0 mt-1 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%"}>{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodTabs value={period} />
        {children}
        <a href={`/api/biznes/hisobot?davr=${period}`} download className={buttonClass({ variant: "outline", size: "sm" })}>
          <Icon name="download" size={16} />
          {t("excel")}
        </a>
      </div>
    </header>
  );
}

function Body({ stats }: { stats: BusinessStats }) {
  return (
    <>
      <Kpis stats={stats} />
      <section className="flex flex-wrap items-stretch gap-2.5">
        <SalesChart stats={stats} />
        <Funnel stats={stats} />
      </section>
      <section className="flex flex-wrap items-stretch gap-2.5">
        <Heatmap stats={stats} />
        <Universities stats={stats} />
      </section>
      <OffersTable stats={stats} />
      <section className="flex flex-wrap items-stretch gap-2.5">
        <RecentSales stats={stats} />
        <CashierBars stats={stats} />
      </section>
    </>
  );
}

/** B6 — biznes statistikasi (veb: kabinet qobig'ida; telefon: pastki navigatsiya bilan, bloklar ustma-ust). */
export function StatsScreen({ stats, now }: { stats: BusinessStats; now: Date }) {
  const t = useTranslations("businessStats");
  return (
    <>
      <LiveRefresh />
      <OwnerFrame
        tab="stats"
        section="stats"
        phone={
          <div className="flex flex-col gap-4 px-4 pt-14 pb-6">
            <StatsHeader now={now} period={stats.period} title={t("title")} phone />
            <Body stats={stats} />
          </div>
        }
        web={
          <>
            <StatsHeader now={now} period={stats.period} title={t("title")} />
            <Body stats={stats} />
          </>
        }
      />
    </>
  );
}
