import { getTranslations } from "next-intl/server";
import { VoidSale } from "@/components/admin/business/ops/void-sale";
import { ToneBadge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatSom } from "@/lib/format";
import { PERIODS, type Period } from "@/lib/stats";
import type { SaleRow } from "@/server/business/sales";
import type { businessStats } from "@/server/business/stats";

const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 text-left text-12 font-semibold text-muted";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5 align-top";
const num = "text-right font-mono tabular-nums";
const TASHKENT_MS = 5 * 60 * 60 * 1000;
const dotDateTime = (at: Date) => {
  const iso = new Date(at.getTime() + TASHKENT_MS).toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
};

/** Davr tanlovi (Bugun / 7 kun / 30 kun) — kartaning `id` va boshqa parametrlari saqlanadi */
async function Periods({ value, href }: { value: Period; href: (p: Period) => string }) {
  const t = await getTranslations("businessStats.period");
  return (
    <nav className="flex w-fit gap-[3px] rounded-10 bg-admin-bg p-[3px]" aria-label="davr">
      {PERIODS.map((p) => (
        <Link key={p} href={href(p)} aria-current={p === value ? "page" : undefined} className={cn("tp-lift flex h-[34px] items-center rounded-8 px-3 text-13 font-bold text-ink no-underline", p === value ? "bg-white" : "bg-transparent")}>
          {t(String(p) as "1")}
        </Link>
      ))}
    </nav>
  );
}

type Stats = Awaited<ReturnType<typeof businessStats>>;

/** Statistika: har chegirma bo'yicha ko'rildi, QR, ishlatildi, tushum; davr bo'yicha jami */
export async function StatsSection({ stats, period, href }: { stats: Stats; period: Period; href: (p: Period) => string }) {
  const t = await getTranslations("adminBusiness.ops.stats");
  const total = stats.offerTotals;
  return (
    <section className="mt-3 flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5" aria-label={t("title")} data-testid="ops-stats">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="m-0 flex-1 text-16 font-extrabold">{t("title")}</h3>
        <Periods value={period} href={href} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-14">
          <thead>
            <tr>
              <th className={th}>{t("discount")}</th>
              <th className={cn(th, "text-right")}>{t("views")}</th>
              <th className={cn(th, "text-right")}>{t("qr")}</th>
              <th className={cn(th, "text-right")}>{t("sold")}</th>
              <th className={cn(th, "text-right")}>{t("revenue")}</th>
            </tr>
          </thead>
          <tbody>
            {stats.offers.length === 0 ? (
              <tr>
                <td className={cn(td, "py-6 text-muted")} colSpan={5}>
                  {t("empty")}
                </td>
              </tr>
            ) : null}
            {stats.offers.map((o) => (
              <tr key={o.id} data-testid="ops-stats-row">
                <td className={cn(td, "font-bold")}>{o.title}</td>
                <td className={cn(td, num)}>{o.views}</td>
                <td className={cn(td, num)}>{o.qr}</td>
                <td className={cn(td, num)}>{o.sold}</td>
                <td className={cn(td, num)}>{formatSom(o.revenue)}</td>
              </tr>
            ))}
            <tr className="font-extrabold" data-testid="ops-stats-total">
              <td className={td}>{t("total")}</td>
              <td className={cn(td, num)}>{total.views}</td>
              <td className={cn(td, num)}>{total.qr}</td>
              <td className={cn(td, num)}>{total.sold}</td>
              <td className={cn(td, num)}>{formatSom(total.revenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

type Sales = { rows: SaleRow[]; count: number; sum: number; page: number; pages: number };

/** Sotuvlar ro'yxati: sana, chegirma, talaba, holat; xato sotuvni sabab bilan bekor qilish */
export async function SalesSection({ sales, period, href }: { sales: Sales; period: Period; href: (p: { davr?: Period; sahifa?: number }) => string }) {
  const t = await getTranslations("adminBusiness.ops.sales");
  return (
    <section className="mt-3 flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5" aria-label={t("title")} data-testid="ops-sales">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="m-0 flex-1 text-16 font-extrabold">{t("title")}</h3>
        <span className="text-13 text-muted">{t("summary", { n: sales.count, sum: formatSom(sales.sum) })}</span>
      </div>
      <p className="m-0 text-13 text-muted">{t("hint")}</p>
      {sales.rows.length === 0 ? (
        <p className="m-0 text-13 text-muted">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-14">
            <thead>
              <tr>
                <th className={th}>{t("date")}</th>
                <th className={th}>{t("discount")}</th>
                <th className={th}>{t("student")}</th>
                <th className={cn(th, "text-right")}>{t("amount")}</th>
                <th className={th}>{t("status")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {sales.rows.map((r) => (
                <tr key={r.id} data-testid="ops-sale">
                  <td className={cn(td, "font-mono")}>{dotDateTime(r.at)}</td>
                  <td className={td}>{r.item}</td>
                  <td className={td}>{r.studentFull || "—"}</td>
                  <td className={cn(td, num)}>{formatSom(r.paid)}</td>
                  <td className={td}>
                    {r.voided ? (
                      <>
                        <ToneBadge tone="bad">{t("voided")}</ToneBadge>
                        <div className="mt-1 text-12 text-muted">{r.voided.reason}</div>
                      </>
                    ) : (
                      <ToneBadge tone="ok">{t("done")}</ToneBadge>
                    )}
                  </td>
                  <td className={td}>{r.voided ? null : <VoidSale redemptionId={r.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sales.pages > 1 ? (
        <div className="flex items-center gap-3 text-13 text-muted">
          {sales.page > 1 ? (
            <Link href={href({ davr: period, sahifa: sales.page - 1 })} className="tp-link font-bold text-blue no-underline">
              {t("prev")}
            </Link>
          ) : null}
          <span className="font-mono">
            {sales.page} / {sales.pages}
          </span>
          {sales.page < sales.pages ? (
            <Link href={href({ davr: period, sahifa: sales.page + 1 })} className="tp-link font-bold text-blue no-underline">
              {t("next")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
