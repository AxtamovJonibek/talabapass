import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { axisTicks, barPercent, linePoints, niceAxis, NEW_STUDENTS_FACTOR, type ShareRow } from "@/lib/admin-stats";
import { cn } from "@/lib/cn";
import { formatMln, formatSom, MINUS } from "@/lib/format";
import type { DaySeries } from "@/server/admin/overview";
import { BlockBusiness } from "./block-business";

const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("min-w-0 rounded-16 bg-white p-5", className)}>{children}</div>
);
const CardTitle = ({ children }: { children: ReactNode }) => <h2 className="m-0 text-17 font-extrabold">{children}</h2>;
const MONO = "font-mono";

const kpiCard = "rounded-16 bg-white p-4";
const kpiValue = "mt-2 text-38 leading-none font-black font-stretch-75%";

export type OverviewKpiData = {
  students: number;
  newToday: number;
  businesses: number;
  activeDiscounts: number;
  salesToday: number;
  salesDelta: number | null;
  saved: number;
  revenue: number;
  queue: { students: number; businesses: number };
};

/** A1 ko'rsatkichlar: 4 oq karta + to'q sariq "Tekshiruv navbati" havolasi. */
export function OverviewKpis({ kpi }: { kpi: OverviewKpiData }) {
  const t = useTranslations("admin.overview.kpi");
  const delta = kpi.salesDelta;
  return (
    <section aria-label={t("label")} className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2.5">
      <div className={kpiCard}>
        <div className="text-13 text-muted">{t("students")}</div>
        <div className={kpiValue}>{formatSom(kpi.students)}</div>
        <div className="mt-1.5 text-12 font-bold text-green">{t("studentsNote", { n: formatSom(kpi.newToday) })}</div>
      </div>
      <div className={kpiCard}>
        <div className="text-13 text-muted">{t("businesses")}</div>
        <div className={kpiValue}>{formatSom(kpi.businesses)}</div>
        <div className="mt-1.5 text-12 text-muted">{t("businessesNote", { n: formatSom(kpi.activeDiscounts) })}</div>
      </div>
      <div className={kpiCard}>
        <div className="text-13 text-muted">{t("sales")}</div>
        <div className={kpiValue}>{formatSom(kpi.salesToday)}</div>
        <div className={cn("mt-1.5 text-12", delta != null && delta >= 0 ? "font-bold text-green" : "text-muted")}>
          {delta == null ? t("salesNoteNone") : t("salesNote", { value: `${delta >= 0 ? "+" : MINUS}${Math.abs(delta)}` })}
        </div>
      </div>
      <div className={kpiCard}>
        <div className="text-13 text-muted">{t("saved")}</div>
        <div className={kpiValue}>{formatMln(kpi.saved)}</div>
        <div className="mt-1.5 text-12 text-muted">{t("savedNote", { revenue: formatMln(kpi.revenue) })}</div>
      </div>
      <Link href="/admin/talabalar" className="block rounded-16 bg-orange p-4 text-ink no-underline">
        <div className="text-13 font-semibold">{t("queue")}</div>
        <div className={kpiValue}>{`${kpi.queue.students} + ${kpi.queue.businesses}`}</div>
        <div className="mt-1.5 text-12 font-bold">{t("queueNote")}</div>
      </Link>
    </section>
  );
}

/** 30 kunlik sotuvlar (ustun) va yangi talabalar ×10 (chiziq). `labels` — o'qdagi sanalar. */
export function SalesTrend({ daily, labels }: { daily: DaySeries; labels: string[] }) {
  const t = useTranslations("admin.overview.trend");
  const max = Math.max(0, ...daily.map((d) => d.sales), ...daily.map((d) => d.students * NEW_STUDENTS_FACTOR));
  const axis = niceAxis(max);
  const last = daily.length - 1;
  return (
    <Card className="flex-[2_1_520px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        <div className="flex gap-3.5 text-12 text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-2 bg-blue" />
            {t("sales")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 bg-orange" />
            {t("students")}
          </span>
        </div>
      </div>
      <div className="mt-4 flex gap-2.5">
        <div className={cn("flex h-[200px] w-[34px] shrink-0 flex-col justify-between text-right text-11 text-muted-2", MONO)}>
          {axisTicks(axis).map((tick) => (
            <span key={tick}>{formatSom(tick)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            role="img"
            aria-label={t("chartLabel")}
            className="flex h-[200px] items-end gap-1 border-0 border-b-[1.5px] border-solid border-ink bg-[linear-gradient(var(--color-surface)_1px,transparent_1px)] bg-[length:100%_50%]"
          >
            {daily.map((d, i) => (
              <div
                key={d.key}
                title={t("tip", { n: formatSom(d.sales) })}
                style={{ height: `${barPercent(d.sales, axis)}%` }}
                className={cn("min-w-0 flex-1 rounded-t-3", i === last ? "bg-orange" : "bg-blue")}
              />
            ))}
          </div>
          <svg aria-hidden="true" viewBox="0 0 300 100" preserveAspectRatio="none" className="absolute top-0 left-0 h-[200px] w-full overflow-visible">
            <polyline points={linePoints(daily.map((d) => d.students), axis)} fill="none" stroke="var(--color-orange)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
          <div className={cn("mt-1.5 flex justify-between text-11 text-muted-2", MONO)}>
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

const SHARE_COLORS = ["bg-ink", "bg-blue", "bg-orange", "bg-share-blue", "bg-share-orange"] as const;
const OTHER_COLOR = "bg-dash-2";

/** Kategoriyalar ulushi va universitetlar (tasdiqlangan talabalar). */
export function CategoriesAndUniversities({ shares, names, universities }: { shares: ShareRow[]; names: Record<string, string>; universities: { name: string; students: number }[] }) {
  const t = useTranslations("admin.overview.categories");
  // "Boshqa" har doim oxirgi (kulrang) rang
  const color = (row: ShareRow, i: number) => (row.key === "other" ? OTHER_COLOR : SHARE_COLORS[Math.min(i, SHARE_COLORS.length - 1)]);
  return (
    <Card className="flex-[1_1_300px]">
      <div className="flex items-baseline justify-between">
        <CardTitle>{t("title")}</CardTitle>
        <span className="text-12 text-muted">{t("note")}</span>
      </div>
      {shares.length === 0 ? (
        <p className="mt-4 mb-0 text-13 text-muted">{t("empty")}</p>
      ) : (
        <>
          <div role="img" aria-label={t("chartLabel")} className="mt-4 flex h-[18px] gap-0.5 overflow-hidden rounded-9">
            {shares.map((row, i) => (
              <div key={row.key} style={{ width: `${row.percent}%` }} className={color(row, i)} />
            ))}
          </div>
          <ul className="mt-4 mb-0 grid list-none grid-cols-2 gap-x-4 gap-y-2.5 p-0 text-13">
            {shares.map((row, i) => (
              <li key={row.key} className="flex items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-2", color(row, i))} />
                <span className="min-w-0 truncate">{row.key === "other" ? t("other") : (names[row.key] ?? row.key)}</span>
                <b className={cn("ml-auto", MONO)}>{row.percent}%</b>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="mt-[22px] mb-0 text-14 font-extrabold">{t("universities")}</h3>
      <ul className="mt-2.5 mb-0 flex list-none flex-col gap-2 p-0 text-13">
        {universities.map((u) => (
          <li key={u.name} className="flex justify-between">
            <span>{u.name}</span>
            <b className={MONO}>{formatSom(u.students)}</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export type RatingRow = {
  id: string;
  name: string;
  initial: string;
  area: string;
  category: string;
  offers: number;
  sold: number;
  saved: number;
  warned: boolean;
};

const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 font-semibold";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5";

/** Bizneslar reytingi (30 kun): ko'rish — A2 kartasi, bloklash — sabab tanlab, tasdiq bilan. */
export function RatingTable({ rows }: { rows: RatingRow[] }) {
  const t = useTranslations("admin.overview.rating");
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        <Link href="/admin/bizneslar" className="text-14 font-bold text-blue no-underline">
          {t("all")}
        </Link>
      </div>
      <div className="mt-2.5 overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-14">
          <thead>
            <tr className="text-left text-12 text-muted">
              <th className={th}>{t("business")}</th>
              <th className={th}>{t("category")}</th>
              <th className={cn(th, "text-right")}>{t("offers")}</th>
              <th className={cn(th, "text-right")}>{t("sales")}</th>
              <th className={cn(th, "text-right")}>{t("saved")}</th>
              <th className={th}>{t("status")}</th>
              <th className={cn(th, "text-right")}>{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={cn(td, "text-muted")}>
                  {t("empty")}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={td}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-8 bg-ink text-13 font-black text-paper">{row.initial}</span>
                    <span className="flex flex-col">
                      <b>{row.name}</b>
                      <span className="text-12 text-muted">{row.area}</span>
                    </span>
                  </div>
                </td>
                <td className={cn(td, "text-muted")}>{row.category}</td>
                <td className={cn(td, "text-right", MONO)}>{row.offers}</td>
                <td className={cn(td, "text-right font-semibold", MONO)}>{formatSom(row.sold)}</td>
                <td className={cn(td, "text-right", MONO)}>{formatMln(row.saved)}</td>
                <td className={td}>
                  <span className={cn("rounded-10 px-2 py-[3px] text-12 font-bold", row.warned ? "bg-warn-bg text-warn" : "bg-green-bg text-green")}>
                    {row.warned ? t("warned") : t("active")}
                  </span>
                </td>
                <td className={cn(td, "text-right")}>
                  <div className="inline-flex gap-1.5">
                    <Link href={`/admin/bizneslar?id=${row.id}`} className="flex h-8 items-center rounded-8 border-hair border-line bg-white px-2.5 text-13 font-semibold text-ink no-underline">
                      {t("view")}
                    </Link>
                    <BlockBusiness businessId={row.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
