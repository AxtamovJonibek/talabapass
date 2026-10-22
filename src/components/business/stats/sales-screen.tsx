import { BackLink } from "@/components/ui/back-button";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatSom } from "@/lib/format";
import type { Period } from "@/lib/stats";
import type { businessSales } from "@/server/business/sales";
import { OwnerFrame } from "../owner-pages";
import { SalesTable } from "./blocks";
import { PeriodTabs } from "./period-tabs";

type Sales = Awaited<ReturnType<typeof businessSales>>;

function Content({ period, sales, phone }: { period: Period; sales: Sales; phone: boolean }) {
  const t = useTranslations("businessStats");
  const href = (page: number) => `/biznes/sotuvlar?davr=${period}&sahifa=${page}`;
  const pager = "tp-lift flex h-11 items-center rounded-12 border-hair px-4 text-14 font-bold no-underline";
  return (
    <div className={cn("flex flex-col gap-4", phone && "px-4 pt-14 pb-6")}>
      {phone ? <BackLink href="/biznes" variant="text" className="-mb-2 self-start" /> : null}
      <header className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-13 text-muted" data-testid="sales-summary">
            {t("sales.summary", { count: formatSom(sales.count), sum: formatSom(sales.sum) })}
          </div>
          <h1 className={cn("m-0 mt-1 leading-none font-black tracking-[-0.035em] font-stretch-112%", phone ? "text-28" : "text-36")}>{t("sales.title")}</h1>
        </div>
        <PeriodTabs value={period} />
      </header>
      <section className="min-w-0 rounded-18 bg-white p-5">
        {sales.rows.length === 0 ? (
          <p className="m-0 text-13 text-muted">{t("sales.empty")}</p>
        ) : (
          <SalesTable
            withDate
            pdf
            sales={sales.rows.map((r) => ({ id: r.id, at: r.at, receiptNo: r.receiptNo, student: r.student, university: r.university, item: r.item, cashier: r.cashier, paid: r.paid }))}
          />
        )}
        {sales.pages > 1 ? (
          <nav className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5">
            {sales.page > 1 ? (
              <Link href={href(sales.page - 1)} className={cn(pager, "border-line text-ink")}>
                {t("sales.prev")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-13 text-muted">{t("sales.page", { page: sales.page, pages: sales.pages })}</span>
            {sales.page < sales.pages ? (
              <Link href={href(sales.page + 1)} className={cn(pager, "border-ink text-ink")}>
                {t("sales.next")}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

/** "Sotuvlar va cheklar" (veb: kabinet qobig'ida; telefon: pastki navigatsiya bilan). */
export function SalesScreen({ period, sales }: { period: Period; sales: Sales }) {
  return (
    <OwnerFrame
      tab="stats"
      section="sales"
      phone={<Content period={period} sales={sales} phone />}
      web={<Content period={period} sales={sales} phone={false} />}
    />
  );
}
