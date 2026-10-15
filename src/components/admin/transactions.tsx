import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { TX_PERIODS, TX_STATUSES, txQuery, type TxFilter } from "@/lib/admin-transactions";
import { cn } from "@/lib/cn";
import { formatSom, MINUS } from "@/lib/format";
import type { TxRow } from "@/server/admin/transactions";

const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 font-semibold";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5";
const MONO = "font-mono";
const OFFSET_MS = 5 * 60 * 60 * 1000;

/** "13.10 14:31:08" (Toshkent) */
function stamp(at: Date) {
  const iso = new Date(at.getTime() + OFFSET_MS).toISOString();
  return { date: `${iso.slice(8, 10)}.${iso.slice(5, 7)}`, time: iso.slice(11, 19) };
}

const tabsShell = "flex gap-[3px] rounded-10 bg-admin-bg p-[3px]";
const tab = (on: boolean) => cn("flex h-[34px] items-center rounded-8 px-3 text-13 font-bold text-ink no-underline", on ? "bg-white" : "bg-transparent");

/** Filtr paneli: holat, davr (havola — holat URL'da), qidiruv va Excel eksport. */
export function TransactionFilters({ filter }: { filter: TxFilter }) {
  const t = useTranslations("admin.transactions");
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div role="tablist" aria-label={t("status.label")} className={tabsShell}>
        {TX_STATUSES.map((status) => (
          <Link key={status} role="tab" aria-selected={filter.status === status} href={`/admin/tranzaksiyalar${txQuery({ ...filter, status, page: 1 })}`} className={tab(filter.status === status)}>
            {t(`status.${status}`)}
          </Link>
        ))}
      </div>
      <div role="tablist" aria-label={t("period.label")} className={tabsShell}>
        {TX_PERIODS.map((period) => (
          <Link key={period} role="tab" aria-selected={filter.period === period} href={`/admin/tranzaksiyalar${txQuery({ ...filter, period, page: 1 })}`} className={tab(filter.period === period)}>
            {t(`period.${period}`)}
          </Link>
        ))}
      </div>
      <form action="/admin/tranzaksiyalar" method="get" role="search" className="flex h-[38px] min-w-[240px] flex-1 items-center gap-2.5 rounded-12 bg-white px-3.5">
        <Icon name="search" size={16} className="text-muted" />
        <label htmlFor="tx-search" className="sr-only">
          {t("search")}
        </label>
        <input
          id="tx-search"
          type="search"
          name="q"
          defaultValue={filter.q}
          maxLength={60}
          placeholder={t("searchPlaceholder")}
          className="min-w-0 flex-1 border-0 bg-transparent font-sans text-14 text-ink outline-none placeholder:text-placeholder-2"
        />
        {filter.status !== "all" ? <input type="hidden" name="holat" value={filter.status} /> : null}
        <input type="hidden" name="davr" value={filter.period} />
      </form>
      <a
        href={`/api/admin/tranzaksiyalar/eksport${txQuery({ ...filter, page: 1 })}`}
        className="flex h-[38px] items-center gap-2 rounded-12 border-hair border-ink bg-white px-3.5 text-14 font-bold text-ink no-underline"
      >
        <Icon name="download" size={16} />
        {t("exportButton")}
      </a>
    </div>
  );
}

export function TransactionTable({ rows, course }: { rows: TxRow[]; course: (code: string) => string }) {
  const t = useTranslations("admin.transactions");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-14">
        <thead>
          <tr className="text-left text-12 text-muted">
            <th className={th}>{t("columns.time")}</th>
            <th className={th}>{t("columns.receipt")}</th>
            <th className={th}>{t("columns.student")}</th>
            <th className={th}>{t("columns.business")}</th>
            <th className={th}>{t("columns.item")}</th>
            <th className={cn(th, "text-right")}>{t("columns.original")}</th>
            <th className={cn(th, "text-right")}>{t("columns.discount")}</th>
            <th className={cn(th, "text-right")}>{t("columns.paid")}</th>
            <th className={th}>{t("columns.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className={cn(td, "py-6 text-muted")}>
                {t("empty")}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const when = stamp(row.at);
            return (
              <tr key={row.id}>
                <td className={cn(td, MONO, "whitespace-nowrap")}>
                  <span className="text-muted">{when.date}</span> {when.time}
                </td>
                <td className={cn(td, MONO, "text-muted")}>{row.receiptNo ? String(row.receiptNo).padStart(6, "0") : "—"}</td>
                <td className={td}>
                  <b>{row.student || "—"}</b>
                  <div className="text-12 text-muted">{[row.university, row.course ? course(row.course) : null].filter(Boolean).join(" · ")}</div>
                </td>
                <td className={td}>
                  {row.business}
                  <div className="text-12 text-muted">{t("cashier", { name: row.cashier })}</div>
                </td>
                <td className={td}>{row.item || "—"}</td>
                <td className={cn(td, "text-right text-muted", MONO)}>{row.original != null ? formatSom(row.original) : "—"}</td>
                <td className={cn(td, "text-right text-rust", MONO)}>{row.discount ? `${MINUS}${formatSom(row.discount)}` : "—"}</td>
                <td className={cn(td, "text-right font-semibold", MONO)}>{row.paid != null ? formatSom(row.paid) : "—"}</td>
                <td className={td}>
                  <span className={cn("text-12 font-bold", row.ok ? "text-green" : "text-danger")}>
                    {row.ok ? t("ok") : t("rejected", { reason: t(`reason.${row.reason ?? "INVALID"}`) })}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Sahifalash: oldingi / keyingi (filtr URL'da saqlanadi). */
export function TransactionPager({ filter, pages, total }: { filter: TxFilter; pages: number; total: number }) {
  const t = useTranslations("admin.transactions");
  const link = "flex h-9 items-center rounded-10 border-hair border-line bg-white px-3.5 text-14 font-bold text-ink no-underline";
  return (
    <nav aria-label={t("pager.label")} className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-13 text-muted">{t("pager.total", { n: formatSom(total) })}</span>
      <div className="flex items-center gap-2">
        {filter.page > 1 ? (
          <Link href={`/admin/tranzaksiyalar${txQuery({ ...filter, page: filter.page - 1 })}`} rel="prev" className={link}>
            ← {t("pager.prev")}
          </Link>
        ) : null}
        <span className={cn("text-13", MONO)}>{t("pager.page", { page: filter.page, pages })}</span>
        {filter.page < pages ? (
          <Link href={`/admin/tranzaksiyalar${txQuery({ ...filter, page: filter.page + 1 })}`} rel="next" className={link}>
            {t("pager.next")} →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
