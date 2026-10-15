import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { TransactionFilters, TransactionPager, TransactionTable } from "@/components/admin/transactions";
import { parseTxFilter } from "@/lib/admin-transactions";
import { formatMln } from "@/lib/format";
import { transactionPage, transactionTotals } from "@/server/admin/transactions";
import { requireRole } from "@/server/auth/session";

// Tranzaksiyalar: kim, qayerda, nima oldi (A1 pastki jadvalidan alohida sahifa)
async function TransactionsContent({ searchParams }: { searchParams: PageProps<"/[locale]/admin/tranzaksiyalar">["searchParams"] }) {
  const admin = await requireRole("ADMIN");
  const filter = parseTxFilter(await searchParams);
  const [t, tc, page, totals] = await Promise.all([
    getTranslations("admin.transactions"),
    getTranslations("course"),
    transactionPage(filter),
    transactionTotals(filter),
  ]);
  const course = (code: string) => (code === "MASTER" ? tc("MASTER_long") : tc("nth", { n: code.slice(1) }));
  const pill = "flex h-[34px] items-center rounded-17 bg-white px-3 text-13 font-semibold";

  return (
    <AdminShell user={admin} active="transactions">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-13 text-muted">{t("sub")}</div>
          <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("title")}</h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={pill}>
            {t("totals.paid")} <b className="ml-1.5 font-mono">{formatMln(totals.paid)}</b>
          </span>
          <span className={pill}>
            {t("totals.saved")} <b className="ml-1.5 font-mono">{formatMln(totals.discount)}</b>
          </span>
        </div>
      </header>
      <section className="flex min-w-0 flex-col gap-3.5 rounded-16 bg-white p-5">
        <TransactionFilters filter={filter} />
        <TransactionTable rows={page.rows} course={course} />
        <TransactionPager filter={filter} pages={page.pages} total={page.total} />
      </section>
    </AdminShell>
  );
}

export default function TransactionsPage({ searchParams }: PageProps<"/[locale]/admin/tranzaksiyalar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TransactionsContent searchParams={searchParams} />
    </Suspense>
  );
}
