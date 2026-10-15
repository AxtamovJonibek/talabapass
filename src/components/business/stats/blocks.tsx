import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { dealBadge, formatMln, formatSom, MINUS } from "@/lib/format";
import { barHeight, heatKey, heatLevel, niceMax, pct, pct1, type Delta, type Period } from "@/lib/stats";
import { formatMinute, toTashkent, weekdayOf } from "@/lib/time";
import type { BusinessStats, StatsOffer, StatsSale } from "@/server/business/stats";

type Weekday = "1" | "2" | "3" | "4" | "5" | "6" | "7";
const HEAT_BG = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;

const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("min-w-0 rounded-18 bg-white p-5", className)}>{children}</div>
);
const CardTitle = ({ children }: { children: ReactNode }) => <h2 className="m-0 text-17 font-extrabold">{children}</h2>;

export const receiptNo = (n: number) => String(n).padStart(6, "0");
export const timeOf = (at: Date) => formatMinute(toTashkent(at).minute);
export const dateOf = (at: Date) => {
  const d = toTashkent(at).date.toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
};
const signed = (n: number) => `${n >= 0 ? "+" : MINUS}${Math.abs(n)}`;

function soldNote(t: ReturnType<typeof useTranslations<"businessStats">>, period: Period, delta: Delta) {
  if (!delta) return null;
  const value = signed(delta.value);
  return period === 1 ? t("deltaDay", { value }) : period === 7 ? t("deltaWeek", { value }) : t("deltaMonth", { value });
}

/** B6 asosiy ko'rsatkichlar (5 ta karta). */
export function Kpis({ stats }: { stats: BusinessStats }) {
  const t = useTranslations("businessStats");
  const k = stats.kpi;
  return (
    <section aria-label={t("kpiLabel")} className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-2.5">
      <StatCard tone="dark" label={t("sold")} value={formatSom(k.sold)} note={soldNote(t, stats.period, k.delta)} />
      <StatCard label={t("revenue")} value={formatMln(k.revenue)} note={t("revenueNote", { average: formatSom(k.average) })} />
      <StatCard label={t("given")} value={formatMln(k.discount)} note={t("givenNote")} valueClassName="text-rust" />
      <StatCard label={t("fresh")} value={formatSom(k.fresh)} note={t("freshNote")} />
      <div className="rounded-18 bg-white p-[18px]">
        <div className="text-13 text-muted">{t("returning")}</div>
        <div className="mt-2 text-44 leading-none font-black font-stretch-75%">{k.returningPercent}%</div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-3 bg-bar">
          <div className="h-1.5 bg-blue" style={{ width: `${k.returningPercent}%` }} />
        </div>
      </div>
    </section>
  );
}

/** Kunlik (soatlik) sotuvlar grafigi. */
export function SalesChart({ stats }: { stats: BusinessStats }) {
  const t = useTranslations("businessStats");
  const weekday = useTranslations("weekday.short");
  const { bars, hourly } = stats.chart;
  const axisMax = niceMax(Math.max(0, ...bars.map((b) => b.count)));
  const week = stats.period === 7;
  const title = t(`chart.${stats.period}`);
  const gap = hourly || week ? "gap-2 @min-[700px]:gap-3.5" : "gap-1";

  const describe = (key: string, i: number) => {
    if (hourly) return { label: key, tip: `${key}:00` };
    const dd = key.slice(8, 10);
    const date = `${dd}.${key.slice(5, 7)}`;
    if (week) return { label: `${weekday(String(weekdayOf(new Date(`${key}T00:00:00Z`))) as Weekday)} ${Number(dd)}`, tip: date };
    return { label: (bars.length - 1 - i) % 5 === 0 ? date : "", tip: date };
  };

  return (
    <Card className="flex-[2_1_520px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-3.5 text-12 text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-2 bg-ink" />
            {t("legendSales")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-2 bg-orange" />
            {hourly ? t("legendHour") : t("legendDay")}
          </span>
        </div>
      </div>
      <div className="mt-[18px] flex gap-2.5">
        <div className="flex h-[220px] w-[26px] shrink-0 flex-col justify-between text-right font-mono text-11 text-muted-2">
          <span>{axisMax}</span>
          <span>{axisMax / 2}</span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div
            role="img"
            aria-label={title}
            className={cn("flex h-[220px] items-end border-b-[1.5px] border-solid border-ink", gap)}
            style={{ background: "linear-gradient(var(--color-surface) 1px, transparent 1px) 0 0 / 100% 50%" }}
          >
            {bars.map((bar, i) => {
              const { label, tip } = describe(bar.key, i);
              return (
                <div
                  key={bar.key}
                  data-testid="chart-bar"
                  data-count={bar.count}
                  title={t("barTip", { label: tip, count: bar.count })}
                  className={cn("min-w-0 flex-1 rounded-t-3", bar.current ? "bg-orange" : bar.count > 0 ? "bg-ink" : "bg-track")}
                  style={{ height: `${barHeight(bar.count, axisMax)}%` }}
                  aria-label={`${label} ${bar.count}`}
                />
              );
            })}
          </div>
          <div className={cn("flex", gap)}>
            {bars.map((bar, i) => (
              <div key={bar.key} className="min-w-0 flex-1 overflow-visible text-center font-mono text-10 whitespace-nowrap text-muted-2">
                {describe(bar.key, i).label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function FunnelRow({ label, count, share, bar, bg }: { label: string; count: number; share?: string; bar: string; bg: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-13">
        <span>{label}</span>
        <b className="font-mono">
          {formatSom(count)}
          {share ? <span className="font-normal text-muted"> · {share}</span> : null}
        </b>
      </div>
      <div className={cn("h-[30px] rounded-6", bg)} style={{ width: bar }} />
    </div>
  );
}

/** Voronka: ko'rdi → QR oldi → sotib oldi. */
export function Funnel({ stats }: { stats: BusinessStats }) {
  const t = useTranslations("businessStats");
  const { views, qr, sold } = stats.funnel;
  const width = (n: number) => `${Math.max(views > 0 ? (n / views) * 100 : 0, 1.5)}%`;
  return (
    <Card className="flex flex-[1_1_300px] flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <CardTitle>{t("funnel.title")}</CardTitle>
        <span className="text-12 text-muted">{t(`periodName.${stats.period}`)}</span>
      </div>
      <FunnelRow label={t("funnel.views")} count={views} bar="100%" bg="bg-track" />
      <FunnelRow label={t("funnel.qr")} count={qr} share={`${pct1(qr, views)}%`} bar={width(qr)} bg="bg-blue" />
      <FunnelRow label={t("funnel.sold")} count={sold} share={`${pct(sold, qr)}%`} bar={width(sold)} bg="bg-orange" />
      {qr > sold ? <p className="m-0 mt-auto border-t border-solid border-surface pt-3 text-13 leading-[1.45] text-muted">{t("funnel.lost", { count: formatSom(qr - sold) })}</p> : null}
    </Card>
  );
}

/** Hafta kuni × soat issiqlik xaritasi (oxirgi 30 kun). */
export function Heatmap({ stats }: { stats: BusinessStats }) {
  const t = useTranslations("businessStats");
  const short = useTranslations("weekday.short");
  const long = useTranslations("weekday.long");
  const { hours, grid, busiest, quietest } = stats.heat;
  const max = Math.max(0, ...grid.values());
  const day = (index: number, form: typeof short | typeof long) => form(String(index + 1) as Weekday);
  return (
    <Card className="flex-[2_1_520px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <CardTitle>
          {t("heat.title")} <span className="text-12 font-normal text-muted">· {t("heat.note")}</span>
        </CardTitle>
        <div className="flex items-center gap-1 text-11 text-muted">
          {t("heat.less")}
          {HEAT_BG.map((bg) => (
            <span key={bg} className={cn("size-3.5 rounded-3", bg)} />
          ))}
          {t("heat.more")}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[520px] gap-1" style={{ gridTemplateColumns: `30px repeat(${hours.length}, minmax(0, 1fr))` }}>
          <div />
          {hours.map((h) => (
            <div key={h} className="text-center font-mono text-10 text-muted-2">
              {String(h).padStart(2, "0")}
            </div>
          ))}
          {Array.from({ length: 7 }, (_, row) => (
            <Row7 key={row} label={day(row, short)} row={row} hours={hours} grid={grid} max={max} tip={(hour, count) => t("heat.tip", { day: day(row, short), hour, count })} />
          ))}
        </div>
      </div>
      {busiest ? (
        <p className="m-0 mt-3.5 text-13 text-muted">
          {t.rich("heat.busiest", {
            day: day(busiest.weekday, long),
            from: formatMinute(busiest.from * 60),
            to: formatMinute(busiest.to * 60),
            b: (chunks) => <b className="text-ink">{chunks}</b>,
          })}{" "}
          {quietest !== null ? t("heat.quietest", { day: day(quietest, long) }) : null}
        </p>
      ) : (
        <p className="m-0 mt-3.5 text-13 text-muted">{t("heat.empty")}</p>
      )}
    </Card>
  );
}

function Row7({ label, row, hours, grid, max, tip }: { label: string; row: number; hours: number[]; grid: BusinessStats["heat"]["grid"]; max: number; tip: (hour: number, count: number) => string }) {
  return (
    <>
      <div className="flex h-[26px] items-center text-12 font-bold text-muted">{label}</div>
      {hours.map((hour) => {
        const count = grid.get(heatKey(row, hour)) ?? 0;
        return <div key={hour} data-testid="heat-cell" data-count={count} title={tip(hour, count)} className={cn("h-[26px] rounded-4", HEAT_BG[heatLevel(count, max)])} />;
      })}
    </>
  );
}

/** Universitetlar bo'yicha sotuvlar. */
export function Universities({ stats }: { stats: BusinessStats }) {
  const t = useTranslations("businessStats");
  const rows = stats.universities;
  const top = Math.max(1, ...rows.map((u) => u.count));
  return (
    <Card className="flex-[1_1_300px]">
      <div className="flex items-baseline justify-between">
        <CardTitle>{t("universities.title")}</CardTitle>
        <span className="text-12 text-muted">{t("universities.sub", { period: t(`periodName.${stats.period}`) })}</span>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 mt-4 text-13 text-muted">{t("universities.empty")}</p>
      ) : (
        <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {rows.map((u) => (
            <li key={u.name || "others"} className="flex flex-col gap-[5px]">
              <div className="flex justify-between text-13">
                <span className="font-semibold">{u.name || t("universities.others")}</span>
                <span className="font-mono">{formatSom(u.count)}</span>
              </div>
              <div className="h-2 rounded-4 bg-heat-0">
                <div className="h-2 rounded-4 bg-blue" style={{ width: `${Math.round((u.count / top) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const STATE_TONE = { ACTIVE: "text-green", ENDED: "text-muted-2", PENDING_REVIEW: "text-warn", PAUSED: "text-muted-2", REJECTED: "text-danger" } as const;
const OFFER_TH = "border-b-[1.5px] border-solid border-ink px-2 py-2.5 font-semibold";
const OFFER_TD = "border-b border-solid border-surface px-2 py-3";

function offerBadge(o: StatsOffer): string {
  if (o.type === "PERCENT" && o.percent != null) return dealBadge({ type: "PERCENT", percent: o.percent });
  if (o.type === "FIXED_PRICE" && o.originalPrice && o.newPrice != null) return dealBadge({ type: "FIXED_PRICE", originalPrice: o.originalPrice, newPrice: o.newPrice });
  return o.type === "BOGO" ? dealBadge({ type: "BOGO" }) : "";
}

/** "Chegirmalar samaradorligi" jadvali. */
export function OffersTable({ stats }: { stats: BusinessStats }) {
  const t = useTranslations("businessStats");
  const total = stats.offerTotals;
  const num = "text-right";
  return (
    <section className="min-w-0 rounded-18 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <CardTitle>{t("offers.title")}</CardTitle>
        <Link href="/biznes/chegirma/yangi" className="text-14 font-bold text-rust no-underline hover:text-ink">
          {t("offers.add")}
        </Link>
      </div>
      {stats.offers.length === 0 ? (
        <p className="m-0 mt-3 text-13 text-muted">{t("offers.empty")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-14">
            <thead>
              <tr className="text-left text-12 text-muted">
                <th className={OFFER_TH}>{t("offers.discount")}</th>
                <th className={OFFER_TH}>{t("offers.status")}</th>
                <th className={cn(OFFER_TH, num)}>{t("offers.views")}</th>
                <th className={cn(OFFER_TH, num)}>{t("offers.qr")}</th>
                <th className={cn(OFFER_TH, num)}>{t("offers.sold")}</th>
                <th className={cn(OFFER_TH, num)}>{t("offers.conversion")}</th>
                <th className={cn(OFFER_TH, num)}>{t("offers.revenue")}</th>
                <th className={cn(OFFER_TH, num)}>{t("offers.given")}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {stats.offers.map((o) => {
                const state = o.ended ? "ENDED" : o.status === "DRAFT" || o.status === "ENDED" ? "ENDED" : o.status;
                return (
                  <tr key={o.id} data-testid="offer-row">
                    <td className={cn(OFFER_TD, "font-sans")}>
                      {offerBadge(o) ? <span className="mr-2 inline-block min-w-[34px] rounded-5 bg-orange px-[5px] py-0.5 text-center text-14 font-black font-stretch-70%">{offerBadge(o)}</span> : null}
                      <b>{o.title}</b>
                    </td>
                    <td className={cn(OFFER_TD, "font-sans text-13 font-bold", STATE_TONE[state])}>{t(`offers.state.${state}`)}</td>
                    <td className={cn(OFFER_TD, num)}>{formatSom(o.views)}</td>
                    <td className={cn(OFFER_TD, num)}>{formatSom(o.qr)}</td>
                    <td className={cn(OFFER_TD, num, "font-semibold")}>{formatSom(o.sold)}</td>
                    <td className={cn(OFFER_TD, num)}>{pct(o.sold, o.qr)}%</td>
                    <td className={cn(OFFER_TD, num)}>{formatSom(o.revenue)}</td>
                    <td className={cn(OFFER_TD, num, "text-rust")}>{formatSom(o.discount)}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold" data-testid="offers-total">
                <td className="px-2 py-3 font-sans">{t("offers.total")}</td>
                <td />
                <td className={cn("px-2 py-3", num)}>{formatSom(total.views)}</td>
                <td className={cn("px-2 py-3", num)}>{formatSom(total.qr)}</td>
                <td className={cn("px-2 py-3", num)}>{formatSom(total.sold)}</td>
                <td className={cn("px-2 py-3", num)}>{pct(total.sold, total.qr)}%</td>
                <td className={cn("px-2 py-3", num)}>{formatSom(total.revenue)}</td>
                <td className={cn("px-2 py-3 text-rust", num)}>{formatSom(total.discount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const SALES_TH = "border-b-[1.5px] border-solid border-ink p-2 font-semibold";
const SALES_TD = "border-b border-solid border-surface px-2 py-2.5";

/** Sotuvlar jadvali: B6 "Oxirgi sotuvlar" va "Sotuvlar va cheklar" sahifasi uchun. */
export function SalesTable({ sales, withDate = false, pdf = false }: { sales: StatsSale[]; withDate?: boolean; pdf?: boolean }) {
  const t = useTranslations("businessStats");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-14">
        <thead>
          <tr className="text-left text-12 text-muted">
            {withDate ? <th className={SALES_TH}>{t("sales.date")}</th> : null}
            <th className={SALES_TH}>{t("sales.time")}</th>
            <th className={SALES_TH}>{t("sales.receipt")}</th>
            <th className={SALES_TH}>{t("sales.student")}</th>
            <th className={SALES_TH}>{t("sales.item")}</th>
            <th className={SALES_TH}>{t("sales.cashier")}</th>
            <th className={cn(SALES_TH, "text-right")}>{t("sales.paid")}</th>
            {pdf ? <th className={SALES_TH} /> : null}
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id} data-testid="sale-row">
              {withDate ? <td className={cn(SALES_TD, "font-mono")}>{dateOf(s.at)}</td> : null}
              <td className={cn(SALES_TD, "font-mono")}>{timeOf(s.at)}</td>
              <td className={cn(SALES_TD, "font-mono text-muted")}>{receiptNo(s.receiptNo)}</td>
              <td className={SALES_TD}>
                <b>{s.student}</b>
                {s.university ? <span className="text-muted"> · {s.university}</span> : null}
              </td>
              <td className={SALES_TD}>{s.item}</td>
              <td className={cn(SALES_TD, "text-muted")}>{s.cashier}</td>
              <td className={cn(SALES_TD, "text-right font-mono font-semibold")}>{formatSom(s.paid)}</td>
              {pdf ? (
                <td className={cn(SALES_TD, "text-right")}>
                  <a href={`/api/chek/${s.id}`} aria-label={t("sales.pdfLabel", { no: receiptNo(s.receiptNo) })} className="text-13 font-bold text-rust no-underline hover:text-ink">
                    {t("sales.pdf")}
                  </a>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** B6 "Oxirgi sotuvlar" bloki. */
export function RecentSales({ stats }: { stats: BusinessStats }) {
  const t = useTranslations("businessStats");
  return (
    <Card className="flex-[2_1_520px]">
      <div className="flex items-center justify-between gap-2.5">
        <CardTitle>{t("recent.title")}</CardTitle>
        <span className="flex items-center gap-1.5 text-12 font-bold text-green">
          <span className="size-2 rounded-4 bg-green-live" />
          {t("recent.live")}
        </span>
      </div>
      <div className="mt-2.5">
        {stats.sales.length === 0 ? <p className="m-0 text-13 leading-[1.45] text-muted">{t("recent.empty")}</p> : <SalesTable sales={stats.sales} />}
      </div>
      <Link href="/biznes/sotuvlar" className="mt-3 inline-flex h-11 items-center text-14 font-bold text-rust no-underline hover:text-ink">
        {t("recent.all")}
      </Link>
    </Card>
  );
}

/** Kassirlar (30 kun) — qora blok. */
export function CashierBars({ stats }: { stats: BusinessStats }) {
  const t = useTranslations("businessStats");
  const { rows, rejected } = stats.cashiers;
  const top = Math.max(1, ...rows.map((c) => c.count));
  return (
    <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 rounded-18 bg-ink p-5 text-paper">
      <h2 className="m-0 text-17 font-extrabold">{t("cashiers.title")}</h2>
      {rows.length === 0 ? <p className="m-0 text-13 text-fog-2">{t("cashiers.empty")}</p> : null}
      {rows.map((c) => (
        <div key={c.name} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-14">
            <span>{c.name}</span>
            <b className="font-mono">{formatSom(c.count)}</b>
          </div>
          <div className="h-2 rounded-4 bg-ink-4">
            <div className="h-2 rounded-4 bg-orange" style={{ width: `${Math.round((c.count / top) * 100)}%` }} />
          </div>
        </div>
      ))}
      <div className="mt-auto flex justify-between border-t border-solid border-ink-4 pt-3 text-13 text-fog-2">
        <span>{t("cashiers.rejected")}</span>
        <b className="font-mono text-white">{formatSom(rejected)}</b>
      </div>
    </div>
  );
}
