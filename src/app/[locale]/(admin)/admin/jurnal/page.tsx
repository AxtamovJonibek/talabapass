import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { JournalList } from "@/components/admin/super/panels";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { Link } from "@/i18n/navigation";
import { localizedPath } from "@/i18n/routing";
import { journal, JOURNAL_GROUPS, JOURNAL_PAGE } from "@/server/admin/super";
import { requireRole } from "@/server/auth/session";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const ENTITIES = ["User", "Business", "Discount", "CashierInvite", "Order", "Landing", "LandingPartner", "University", "Notification", "Verification"] as const;
const input = "box-border h-10 min-w-0 rounded-10 border-hair border-line bg-white px-3 font-sans text-13 text-ink outline-none focus:border-ink";

// Faoliyat jurnali (super admin): barcha `AuditLog` yozuvlari — filtr va qidiruv URL'da
async function JournalContent({ searchParams }: { searchParams: PageProps<"/[locale]/admin/jurnal">["searchParams"] }) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const f = {
    group: first(query.bolim).slice(0, 20),
    actor: first(query.kim).slice(0, 80),
    entity: (ENTITIES as readonly string[]).includes(first(query.obyekt)) ? first(query.obyekt) : "",
    entityId: first(query.id).slice(0, 40),
    from: first(query.dan).slice(0, 10),
    to: first(query.gacha).slice(0, 10),
    q: first(query.q).slice(0, 80),
    page: Math.max(1, Number.parseInt(first(query.sahifa), 10) || 1),
  };
  const [t, data] = await Promise.all([getTranslations("adminSuper.journal"), journal(f)]);
  const pages = Math.max(1, Math.ceil(data.total / JOURNAL_PAGE));
  const pageHref = (page: number) => {
    const sp = new URLSearchParams({ bolim: f.group, kim: f.actor, obyekt: f.entity, id: f.entityId, dan: f.from, gacha: f.to, q: f.q, sahifa: String(page) });
    return `/admin/jurnal?${sp}`;
  };

  return (
    <AdminShell user={admin} active="journal">
      <header>
        <div className="text-13 text-muted">{t("sub")}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("title")}</h1>
      </header>
      <section className="flex flex-col gap-3 rounded-16 bg-white p-5">
        <form action={localizedPath("/admin/jurnal")} method="get" className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] items-end gap-2.5" data-testid="journal-filter">
          <label className="flex flex-col gap-1 text-12 font-semibold">
            {t("group")}
            <select name="bolim" defaultValue={f.group} className={input}>
              <option value="">—</option>
              {JOURNAL_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {t(`groups.${g}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-12 font-semibold">
            {t("actor")}
            <input name="kim" defaultValue={f.actor} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-12 font-semibold">
            {t("entity")}
            <select name="obyekt" defaultValue={f.entity} className={input}>
              <option value="">—</option>
              {ENTITIES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-12 font-semibold">
            {t("entityId")}
            <input name="id" defaultValue={f.entityId} className={`${input} font-mono`} />
          </label>
          <label className="flex flex-col gap-1 text-12 font-semibold">
            {t("from")}
            <input type="date" name="dan" defaultValue={f.from} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-12 font-semibold">
            {t("to")}
            <input type="date" name="gacha" defaultValue={f.to} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-12 font-semibold">
            {t("q")}
            <input type="search" name="q" defaultValue={f.q} className={input} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="tp-btn tp-stamp [--tp-shadow:var(--color-orange)] h-10 rounded-10 border-0 bg-ink px-4 font-sans text-13 font-bold text-white">
              {t("filter")}
            </button>
            <Link href="/admin/jurnal" className="tp-link flex h-10 items-center px-2 text-13 font-bold text-ink">
              {t("reset")}
            </Link>
          </div>
        </form>
        <div className="text-13 text-muted" data-testid="journal-total">
          {t("total", { count: data.total })}
        </div>
        <JournalList rows={data.rows} />
        <div className="flex items-center justify-end gap-3 text-13">
          {f.page > 1 ? (
            <Link href={pageHref(f.page - 1)} className="tp-link font-bold text-ink">
              ←
            </Link>
          ) : null}
          <span className="text-muted">
            {f.page} / {pages}
          </span>
          {f.page < pages ? (
            <Link href={pageHref(f.page + 1)} className="tp-link font-bold text-ink">
              →
            </Link>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}

export default function AdminJournalPage({ searchParams }: PageProps<"/[locale]/admin/jurnal">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <JournalContent searchParams={searchParams} />
    </Suspense>
  );
}
