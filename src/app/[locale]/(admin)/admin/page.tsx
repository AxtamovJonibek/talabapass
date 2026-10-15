import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { CategoriesAndUniversities, OverviewKpis, RatingTable, SalesTrend, type RatingRow } from "@/components/admin/overview/blocks";
import { Icon } from "@/components/ui/icon";
import { categoryShares, weekOverWeek } from "@/lib/admin-stats";
import { formatMinute, toTashkent } from "@/lib/time";
import { businessRating, platformOverview } from "@/server/admin/overview";
import { requireRole } from "@/server/auth/session";

// A1 — platforma umumiy ko'rinishi
async function OverviewContent() {
  const admin = await requireRole("ADMIN");
  const now = new Date();
  const [overview, rating, t, weekday, month] = await Promise.all([
    platformOverview(now),
    businessRating(now),
    getTranslations("admin.overview"),
    getTranslations("weekday.long"),
    getTranslations("month.name"),
  ]);

  const local = toTashkent(now);
  const date = `${weekday(String(local.weekday) as "1")}, ${local.date.getUTCDate()}-${month(String(local.date.getUTCMonth() + 1) as "1")} · ${formatMinute(local.minute)} · ${t("realtime")}`;

  const { kpi } = overview;
  const label = (index: number) => {
    const day = overview.daily[index]!.key; // 2026-09-14
    return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
  };
  // O'qdagi sanalar dizayndagidek: har 7 kunda bir, oxirida "bugun"
  const labels = [0, 7, 14, 21].map(label).concat(t("today"));

  const names = Object.fromEntries(overview.categories.map((c) => [c.key, c.name]));
  const rows: RatingRow[] = rating.map((b) => ({
    id: b.id,
    name: b.name,
    initial: b.name.charAt(0).toUpperCase(),
    area: b.area ?? "",
    category: b.category ?? "—",
    offers: b.offers,
    sold: b.sold,
    saved: b.saved,
    warned: b.status === "WARNED",
  }));

  return (
    <AdminShell user={admin} active="overview">
      <header className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-13 text-muted">{date}</div>
          <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("title")}</h1>
        </div>
        {/* Qidiruv — tranzaksiyalar sahifasiga (chek №, talaba, biznes, STIR) */}
        <form action="/admin/tranzaksiyalar" method="get" role="search" className="flex h-11 min-w-[260px] items-center gap-2.5 rounded-12 bg-white px-3.5">
          <Icon name="search" size={18} className="text-muted" />
          <label htmlFor="admin-search" className="sr-only">
            {t("search")}
          </label>
          <input
            id="admin-search"
            type="search"
            name="q"
            maxLength={60}
            placeholder={t("searchPlaceholder")}
            className="min-w-0 flex-1 border-0 bg-transparent font-sans text-14 text-ink outline-none placeholder:text-placeholder-2"
          />
          <input type="hidden" name="davr" value="all" />
        </form>
      </header>

      <OverviewKpis
        kpi={{
          students: kpi.students,
          newToday: kpi.newToday,
          businesses: kpi.businesses,
          activeDiscounts: kpi.activeDiscounts,
          salesToday: kpi.salesToday,
          salesDelta: weekOverWeek(kpi.salesToday, kpi.salesLastWeek),
          saved: kpi.saved,
          revenue: kpi.revenue,
          queue: { students: overview.queue.students, businesses: overview.queue.businesses },
        }}
      />

      <section className="flex flex-wrap gap-2.5">
        <SalesTrend daily={overview.daily} labels={labels} />
        <CategoriesAndUniversities shares={categoryShares(overview.categories.map((c) => ({ key: c.key, count: c.count })))} names={names} universities={overview.universities} />
      </section>

      <RatingTable rows={rows} />
    </AdminShell>
  );
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}
