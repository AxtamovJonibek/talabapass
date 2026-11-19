import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { BusinessAdminForm } from "@/components/admin/manage/forms";
import { BusinessBlockControl, PermissionsForm, RemoveLogoButton, RemovePhotoButton, UploadButton } from "@/components/admin/super/controls";
import { DiscountAdminRow } from "@/components/admin/super/discount-admin";
import { JournalList } from "@/components/admin/super/panels";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { ToneBadge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { localizedPath } from "@/i18n/routing";
import { BUSINESS_KINDS } from "@/lib/business";
import { cn } from "@/lib/cn";
import { formatContact, formatSom } from "@/lib/format";
import { tashkentStamp } from "@/lib/journal";
import { businessLogoUrl } from "@/lib/profile-image";
import { parsePeriod, PERIODS } from "@/lib/stats";
import { businessFull } from "@/server/admin/directory";
import { businessAdminDetail, businessPermissions, entityJournal, listBusinesses, PARTNERS_PAGE } from "@/server/admin/super";
import { requireRole } from "@/server/auth/session";
import { businessSales } from "@/server/business/sales";
import { businessStats } from "@/server/business/stats";

const STATUSES = ["ALL", "APPROVED", "WARNED", "PENDING", "REJECTED", "BLOCKED"] as const;
const TONE = { APPROVED: "ok", WARNED: "warn", PENDING: "info", REJECTED: "bad", BLOCKED: "bad" } as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 text-left text-12 font-semibold text-muted";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5 align-top";
const card = "flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5";

function href(p: { holat?: string; q?: string; sahifa?: number; id?: string; davr?: number }) {
  const sp = new URLSearchParams();
  if (p.holat && p.holat !== "ALL") sp.set("holat", p.holat);
  if (p.q) sp.set("q", p.q);
  if (p.sahifa && p.sahifa > 1) sp.set("sahifa", String(p.sahifa));
  if (p.id) sp.set("id", p.id);
  if (p.davr) sp.set("davr", String(p.davr));
  return `/admin/hamkorlar?${sp}`;
}

// Super admin: barcha bizneslar — ma'lumotlar, logotip/fotolar, ruxsatlar, statistika, sotuvlar (+ Excel), chegirmalar, jurnal
async function PartnersContent({ searchParams }: { searchParams: PageProps<"/[locale]/admin/hamkorlar">["searchParams"] }) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const status = (STATUSES as readonly string[]).includes(first(query.holat)) ? first(query.holat) : "ALL";
  const q = first(query.q).slice(0, 80);
  const page = Math.max(1, Number.parseInt(first(query.sahifa), 10) || 1);
  const id = first(query.id).slice(0, 40);
  const period = parsePeriod(first(query.davr) || undefined);

  const [t, m, kinds, list, detail, periodLabel] = await Promise.all([
    getTranslations("adminSuper"),
    getTranslations("adminManage"),
    getTranslations("businessKind"),
    listBusinesses({ q, status, page }),
    id ? businessAdminDetail(id) : Promise.resolve(null),
    getTranslations("businessStats.period"),
  ]);
  const [full, permissions, stats, sales, activity] = detail
    ? await Promise.all([businessFull(detail.id), businessPermissions(detail.id), businessStats(detail.id, period), businessSales(detail.id, period, 1), entityJournal("Business", detail.id)])
    : [null, null, null, null, []];
  const pages = Math.max(1, Math.ceil(list.total / PARTNERS_PAGE));
  const kindLabels = Object.fromEntries(BUSINESS_KINDS.map((k) => [k, kinds(k)]));
  const personName = (u: { firstName: string | null; lastName: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
  const logoUrl = detail ? businessLogoUrl(detail.id, detail.logoKey) : null;

  return (
    <AdminShell user={admin} active="partners">
      <header>
        <div className="text-13 text-muted">{t("partners.sub")}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("partners.title")}</h1>
      </header>

      <div className="flex flex-wrap items-start gap-3">
        <section className={cn(card, "flex-[1_1_380px]")}>
          <div role="tablist" aria-label={t("partners.title")} className="flex w-fit flex-wrap gap-[3px] rounded-10 bg-admin-bg p-[3px]">
            {STATUSES.map((s) => (
              <Link key={s} role="tab" aria-selected={s === status} href={href({ holat: s, q })} className={cn("tp-lift flex h-[34px] items-center rounded-8 px-3 text-13 font-bold text-ink no-underline", s === status ? "bg-white" : "bg-transparent")}>
                {t(`partners.status.${s}`)}
              </Link>
            ))}
          </div>
          <form action={localizedPath("/admin/hamkorlar")} method="get" className="flex gap-2">
            {status !== "ALL" ? <input type="hidden" name="holat" value={status} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label={m("search")}
              placeholder={t("partners.searchPlaceholder")}
              className="box-border h-11 min-w-0 flex-1 rounded-12 border-hair border-line bg-white px-3.5 font-sans text-14 text-ink outline-none focus:border-ink"
            />
            <button type="submit" className="tp-btn tp-stamp [--tp-shadow:var(--color-orange)] h-11 rounded-12 border-0 bg-ink px-4 font-sans text-14 font-bold text-white">
              {m("search")}
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] border-collapse text-14" data-testid="partners-table">
              <tbody>
                {list.rows.length === 0 ? (
                  <tr>
                    <td className={cn(td, "py-6 text-muted")}>{m("empty")}</td>
                  </tr>
                ) : null}
                {list.rows.map((b) => (
                  <tr key={b.id} className={cn(b.id === id && "bg-paper")}>
                    <td className={td}>
                      <Link href={href({ holat: status, q, sahifa: page, id: b.id })} className="tp-link font-bold text-ink no-underline">
                        {b.name}
                      </Link>
                      <div className="text-12 text-muted">
                        {kinds(b.kind)} · {personName(b.owner)}
                      </div>
                    </td>
                    <td className={cn(td, "text-right")}>
                      <ToneBadge tone={TONE[b.status]}>{t(`partners.status.${b.status}`)}</ToneBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-13 text-muted">
            <span>{m("page", { page, total: list.total })}</span>
            <span className="flex gap-3">
              {page > 1 ? (
                <Link href={href({ holat: status, q, sahifa: page - 1 })} className="tp-link font-bold text-ink">
                  {m("prev")}
                </Link>
              ) : null}
              {page < pages ? (
                <Link href={href({ holat: status, q, sahifa: page + 1 })} className="tp-link font-bold text-ink">
                  {m("next")}
                </Link>
              ) : null}
            </span>
          </div>
        </section>

        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-3">
          {detail && full && permissions && stats && sales ? (
            <>
              <section className={card} data-testid="partner-detail">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-22 font-black tracking-[-0.02em]">{detail.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-13 text-muted">
                      <ToneBadge tone={TONE[detail.status]}>{t(`partners.status.${detail.status}`)}</ToneBadge>
                      <span>
                        {t("partners.owner")}: {personName(detail.owner)} · <span className="font-mono">{formatContact(detail.owner)}</span>
                      </span>
                      <Link href={`/admin/foydalanuvchilar?rol=BUSINESS_OWNER&id=${detail.owner.id}`} className="tp-link font-bold text-ink">
                        {t("partners.openOwner")}
                      </Link>
                    </div>
                    {detail.rejectReason && detail.status === "BLOCKED" ? <div className="mt-1 text-13 font-bold text-danger">{detail.rejectReason}</div> : null}
                  </div>
                  <BusinessBlockControl businessId={detail.id} blocked={detail.status === "BLOCKED"} />
                </div>
              </section>

              <section className={card} aria-label={t("partners.stats.title")}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="m-0 text-16 font-extrabold">{t("partners.stats.title")}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-[3px] rounded-10 bg-admin-bg p-[3px]">
                      {PERIODS.map((p) => (
                        <Link key={p} href={href({ holat: status, q, sahifa: page, id: detail.id, davr: p })} className={cn("tp-lift flex h-8 items-center rounded-8 px-3 text-13 font-bold text-ink no-underline", p === period ? "bg-white" : "bg-transparent")}>
                          {periodLabel(String(p) as "1")}
                        </Link>
                      ))}
                    </div>
                    <a href={`/api/admin/biznes/hisobot?id=${detail.id}&davr=${period}`} className="tp-link text-13 font-bold text-ink" data-testid="partner-excel">
                      {t("partners.stats.excel")}
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-2" data-testid="partner-stats">
                  {(
                    [
                      ["sold", formatSom(stats.kpi.sold)],
                      ["revenue", formatSom(stats.kpi.revenue)],
                      ["given", formatSom(stats.kpi.discount)],
                      ["coupons", formatSom(stats.funnel.qr)],
                      ["fresh", formatSom(stats.kpi.fresh)],
                      ["returning", `${stats.kpi.returningPercent}%`],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1 rounded-12 bg-paper px-3.5 py-3">
                      <span className="text-12 text-muted">{t(`partners.stats.${key}`)}</span>
                      <span className="font-mono text-20 font-semibold" data-kpi={key}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <h4 className="m-0 mt-1 text-14 font-extrabold">
                  {t("partners.sales.title")} · <span className="font-normal text-muted">{t("partners.sales.summary", { count: formatSom(sales.count), sum: formatSom(sales.sum) })}</span>
                </h4>
                {sales.rows.length === 0 ? (
                  <p className="m-0 text-13 text-muted">{t("partners.sales.empty")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-13">
                      <tbody>
                        {sales.rows.map((r) => (
                          <tr key={r.id}>
                            <td className={cn(td, "font-mono whitespace-nowrap text-muted")}>{tashkentStamp(r.at)}</td>
                            <td className={td}>
                              <b>{r.student}</b> <span className="text-muted">· {r.university}</span>
                            </td>
                            <td className={td}>{r.item}</td>
                            <td className={cn(td, "text-muted")}>{r.cashier}</td>
                            <td className={cn(td, "text-right font-mono font-semibold")}>{formatSom(r.paid)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className={card} aria-label={t("partners.permissions.title")}>
                <h3 className="m-0 text-16 font-extrabold">{t("partners.permissions.title")}</h3>
                <PermissionsForm key={detail.id} businessId={detail.id} initial={permissions} />
              </section>

              <section className={card} aria-label={t("partners.media")}>
                <h3 className="m-0 text-16 font-extrabold">{t("partners.media")}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex size-20 items-center justify-center overflow-hidden rounded-16 bg-surface text-12 text-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili */}
                    {logoUrl ? <img src={logoUrl} alt={t("partners.logo")} className="size-full object-cover" /> : t("partners.noLogo")}
                  </div>
                  <UploadButton query={`tur=logo&biznes=${detail.id}`} label={t("partners.upload")} testId="logo-upload" />
                  {logoUrl ? <RemoveLogoButton businessId={detail.id} /> : null}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-13 font-semibold">{t("partners.photos")}</span>
                  <div className="flex flex-wrap gap-3">
                    {detail.docs.length === 0 ? <span className="text-13 text-muted">{t("partners.noPhotos")}</span> : null}
                    {detail.docs.map((d) => (
                      <div key={d.id} className="flex flex-col items-start gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- admin fayl manzili (audit bilan) */}
                        <img src={`/api/admin/fayl/hujjat/${d.id}?maqsad=boshqaruv`} alt={d.fileName} className="h-24 w-32 rounded-10 object-cover" />
                        <RemovePhotoButton docId={d.id} />
                      </div>
                    ))}
                  </div>
                  {detail.docs.length < 3 ? <UploadButton query={`tur=foto&biznes=${detail.id}`} label={t("partners.upload")} testId="photo-upload" /> : null}
                </div>
              </section>

              <section className={card} aria-label={t("partners.info")}>
                <h3 className="m-0 text-16 font-extrabold">{t("partners.info")}</h3>
                <BusinessAdminForm
                  key={full.id}
                  kindLabels={kindLabels}
                  business={{
                    id: full.id,
                    name: full.name,
                    legalName: full.legalName ?? "",
                    tin: full.tin ?? "",
                    kind: full.kind,
                    typeLabel: full.typeLabel ?? "",
                    address: full.address,
                    landmark: full.landmark ?? "",
                    lat: full.lat?.toString() ?? "",
                    lng: full.lng?.toString() ?? "",
                    workingHours: full.workingHours,
                    description: full.description ?? "",
                    contactName: full.contactName ?? "",
                    contactPhone: full.contactPhone ?? "",
                    publicPhone: full.publicPhone ?? "",
                    telegram: full.telegram ?? "",
                    instagram: full.instagram ?? "",
                  }}
                />
              </section>

              <section className={card} aria-label={t("partners.discounts.title")}>
                <h3 className="m-0 text-16 font-extrabold">{t("partners.discounts.title")}</h3>
                {detail.discounts.length === 0 ? (
                  <p className="m-0 text-13 text-muted">{t("partners.discounts.empty")}</p>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {detail.discounts.map((d) => (
                      <DiscountAdminRow key={d.id} discount={{ ...d, startsOn: iso(d.startsOn), endsOn: iso(d.endsOn), terms: d.terms ?? "" }} />
                    ))}
                  </ul>
                )}
              </section>

              <section className={card}>
                <JournalList rows={activity} title={t("journal.businessTitle")} allHref={`/admin/jurnal?obyekt=Business&id=${detail.id}`} />
              </section>
            </>
          ) : (
            <section className={card}>
              <p className="m-0 text-14 text-muted">{t("partners.pickHint")}</p>
            </section>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

export default function AdminPartnersPage({ searchParams }: PageProps<"/[locale]/admin/hamkorlar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PartnersContent searchParams={searchParams} />
    </Suspense>
  );
}
