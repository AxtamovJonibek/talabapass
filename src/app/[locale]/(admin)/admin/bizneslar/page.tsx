import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { BusinessReview } from "@/components/admin/business-review";
import { ChangesLog } from "@/components/admin/business/changes-log";
import { ContactNotes } from "@/components/admin/business/contact-notes";
import { BusinessAdminForm } from "@/components/admin/manage/forms";
import { UploadButton } from "@/components/admin/super/controls";
import { QueuePanel, ReviewHeader, type CheckRow, type QueueItem } from "@/components/admin/review-parts";
import { Link } from "@/i18n/navigation";
import { BUSINESS_KINDS } from "@/lib/business";
import { cn } from "@/lib/cn";
import { formatContact, formatPhone } from "@/lib/format";
import { businessLogoUrl } from "@/lib/profile-image";
import { businessChanges, businessList, contactNotes, isListStatus, LIST_STATUSES, type ListStatus } from "@/server/admin/business-card";
import { businessDetail, businessQueue, reviewStats } from "@/server/admin/review";
import { ageLabel, averageWait } from "@/server/admin/review-rules";
import { requireRole } from "@/server/auth/session";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

const TASHKENT_MS = 5 * 60 * 60 * 1000;
const tashkentIso = (at: Date) => new Date(at.getTime() + TASHKENT_MS).toISOString();
const dotDate = (at: Date) => {
  const iso = tashkentIso(at);
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
};
const dotDateTime = (at: Date) => `${dotDate(at)} ${tashkentIso(at).slice(11, 16)}`;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 font-semibold";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5 align-middle";
const chip = (on: boolean) => cn("tp-lift flex h-[34px] items-center gap-2 rounded-8 px-3 text-13 font-bold text-ink no-underline", on ? "bg-white" : "bg-transparent");
const TONE: Record<string, string> = { PENDING: "bg-warn-bg text-warn", APPROVED: "bg-green-bg text-green", WARNED: "bg-green-bg text-green", REJECTED: "bg-danger-bg text-danger", BLOCKED: "bg-danger-bg text-danger" };

// Biznes ro'yxati: qidiruv (nom, STIR, telefon), holat filtri; qator — nom, telefon, holat, ariza sanasi
async function BusinessListContent({ searchParams }: { searchParams: PageProps<"/[locale]/admin/bizneslar">["searchParams"] }) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const q = (one(query.q) ?? "").slice(0, 80);
  const statusParam = one(query.holat);
  const status: ListStatus | null = isListStatus(statusParam) ? statusParam : statusParam === "hammasi" ? null : "pending";
  const page = Math.max(1, Number(one(query.sahifa)) || 1);
  const [t, tb, list] = await Promise.all([getTranslations("admin.review"), getTranslations("adminBusiness"), businessList({ q, status, page })]);
  const href = (patch: { holat?: string; sahifa?: number }) => {
    const params = new URLSearchParams();
    const holat = patch.holat ?? (status ?? "hammasi");
    if (holat !== "pending") params.set("holat", holat);
    if (q) params.set("q", q);
    if (patch.sahifa && patch.sahifa > 1) params.set("sahifa", String(patch.sahifa));
    const qs = params.toString();
    return `/admin/bizneslar${qs ? `?${qs}` : ""}`;
  };

  return (
    <AdminShell user={admin} active="businesses">
      <header>
        <div className="text-13 text-muted">{tb("listSub")}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("businessesTitle")}</h1>
      </header>
      <section className="flex min-w-0 flex-col gap-3.5 rounded-16 bg-white p-5">
        <form action="/admin/bizneslar" method="get" role="search" className="flex flex-wrap gap-2">
          <input type="hidden" name="holat" value={status ?? "hammasi"} />
          <input name="q" defaultValue={q} placeholder={tb("search")} aria-label={tb("search")} maxLength={80} className="box-border h-11 min-w-0 flex-1 basis-[240px] rounded-12 border-[1.5px] border-solid border-line bg-white px-3.5 text-15 text-ink" />
          <button type="submit" className="tp-btn tp-stamp h-11 cursor-pointer rounded-12 border-0 bg-ink px-5 text-14 font-bold text-white">
            {tb("searchBtn")}
          </button>
        </form>
        <nav aria-label={tb("listSub")} className="flex w-fit flex-wrap gap-[3px] rounded-10 bg-admin-bg p-[3px]">
          <Link href={href({ holat: "hammasi" })} aria-current={status === null ? "page" : undefined} className={chip(status === null)}>
            {tb("filters.all")}
          </Link>
          {LIST_STATUSES.map((k) => (
            <Link key={k} href={href({ holat: k })} aria-current={status === k ? "page" : undefined} className={chip(status === k)}>
              {tb(`filters.${k}`)} <span className="font-mono text-12 text-muted">{list.counts[k]}</span>
            </Link>
          ))}
        </nav>
        {list.items.length === 0 ? (
          <p className="m-0 text-14 text-muted">{tb("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-14" data-testid="business-list">
              <thead>
                <tr className="text-left text-12 text-muted">
                  <th className={th}>{tb("columns.name")}</th>
                  <th className={th}>{tb("columns.phone")}</th>
                  <th className={th}>{tb("columns.status")}</th>
                  <th className={th}>{tb("columns.date")}</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {list.items.map((b) => {
                  const phone = b.contactPhone ?? b.owner.phone ?? b.publicPhone;
                  return (
                    <tr key={b.id}>
                      <td className={cn(td, "font-bold")}>{b.name}</td>
                      <td className={cn(td, "font-mono")}>{phone ? formatPhone(phone) : "—"}</td>
                      <td className={td}>
                        <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-12 font-bold", TONE[b.status])}>{tb(`status.${b.status}`)}</span>
                      </td>
                      <td className={cn(td, "font-mono")}>{dotDate(b.submittedAt ?? b.createdAt)}</td>
                      <td className={cn(td, "text-right")}>
                        <Link href={`/admin/bizneslar?id=${b.id}`} className="tp-lift tap inline-flex h-8 items-center rounded-8 border-hair border-line bg-white px-2.5 text-13 font-semibold text-ink no-underline">
                          {tb("open")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 text-13 text-muted">
          <span>{tb("total", { n: list.total })}</span>
          {list.pages > 1 ? (
            <span className="ml-auto flex items-center gap-2">
              {list.page > 1 ? (
                <Link href={href({ sahifa: list.page - 1 })} className="tp-link font-bold text-blue no-underline">
                  {tb("prev")}
                </Link>
              ) : null}
              <span className="font-mono">{tb("page", { page: list.page, pages: list.pages })}</span>
              {list.page < list.pages ? (
                <Link href={href({ sahifa: list.page + 1 })} className="tp-link font-bold text-blue no-underline">
                  {tb("next")}
                </Link>
              ) : null}
            </span>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}

// A2 (biznes) — karta: tekshiruv, ma'lumotlar, aloqa qaydlari, o'zgarishlar jurnali
async function BusinessCardContent({ id }: { id: string }) {
  const admin = await requireRole("ADMIN");
  const [t, kinds, ts, tb] = await Promise.all([getTranslations("admin.review"), getTranslations("businessKind"), getTranslations("adminSuper"), getTranslations("adminBusiness")]);
  const now = new Date();

  const [queue, stats] = await Promise.all([businessQueue(), reviewStats("businesses")]);
  const selectedId = id;
  const [detail, notes, changes] = await Promise.all([businessDetail(selectedId), contactNotes(selectedId), businessChanges(selectedId)]);
  const todayIso = tashkentIso(now).slice(0, 10);

  const agoText = (date: Date) => {
    const a = ageLabel(date, now);
    return t(`ago.${a.unit}`, { n: a.value });
  };
  const items: QueueItem[] = queue.items.map((b) => {
    const hasRegistration = b.docs.some((d) => d.kind === "REGISTRATION");
    return {
      id: b.id,
      href: `/admin/bizneslar?id=${b.id}`,
      initials: initialsOf(b.name),
      photoUrl: businessLogoUrl(b.id, b.logoKey),
      name: b.name,
      ago: agoText(b.submittedAt ?? b.createdAt),
      meta: [kinds(b.kind), b.district?.name, b.address].filter(Boolean).join(" · "),
      flag: hasRegistration ? t("flags.docsComplete") : t("flags.docsMissing"),
      flagTone: hasRegistration ? "ok" : "warn",
    };
  });

  const position = queue.items.findIndex((b) => b.id === selectedId);
  const next = queue.items[position + 1] ?? queue.items.find((b) => b.id !== selectedId);
  const nextHref = next ? `/admin/bizneslar?id=${next.id}` : "/admin/bizneslar";
  const wait = averageWait(stats.reviewed);

  const rows: CheckRow[] = detail
    ? [
        {
          key: "tin",
          label: t("fields.tin"),
          value: detail.tin ?? "—",
          check: detail.tin ? (detail.tinTaken ? t("checks.duplicate") : t("checks.unique")) : t("checks.none"),
          tone: detail.tin ? (detail.tinTaken ? "bad" : "ok") : "muted",
        },
        { key: "legalName", label: t("fields.legalName"), value: detail.legalName ?? "—", check: t("checks.none"), tone: "muted" },
        { key: "contact", label: t("fields.contact"), value: detail.contactName ?? "—", check: t("checks.none"), tone: "muted" },
        {
          key: "phone",
          label: t("fields.phone"),
          value: detail.contactPhone ? formatPhone(detail.contactPhone) : formatContact(detail.owner),
          check: t("checks.smsVerified"),
          tone: "ok",
        },
        { key: "publicPhone", label: t("fields.applicantPhone"), value: detail.publicPhone ? formatPhone(detail.publicPhone) : "—", check: t("checks.none"), tone: "muted" },
        { key: "telegram", label: t("fields.telegram"), value: detail.telegram ? `@${detail.telegram}` : "—", check: t("checks.none"), tone: "muted" },
        { key: "hours", label: t("fields.hours"), value: detail.workingHours, check: t("checks.none"), tone: "muted" },
        { key: "firstDiscount", label: t("fields.firstDiscount"), value: detail.discounts[0]?.title ?? "—", check: t("checks.none"), tone: "muted" },
      ]
    : [];

  return (
    <AdminShell user={admin} active="businesses">
      <Link href="/admin/bizneslar" className="tp-link text-14 font-bold text-blue no-underline">
        {tb("back")}
      </Link>
      <ReviewHeader
        title={t("businessesTitle")}
        sub={t("businessesSub")}
        approvedToday={stats.approvedToday}
        wait={wait ? t("wait", { hours: wait.hours, minutes: wait.minutes }) : t("waitNone")}
      />
      <div className="flex flex-wrap items-start gap-3">
        <QueuePanel items={items} selectedId={selectedId} more={Math.max(0, queue.total - items.length)} />
        {detail ? (
          <BusinessReview
            key={detail.id}
            businessId={detail.id}
            code={t("sentAgo", { code: `ARIZA-B-${detail.id.slice(-5).toUpperCase()}`, ago: agoText(detail.submittedAt ?? detail.createdAt) })}
            name={detail.name}
            photoUrl={businessLogoUrl(detail.id, detail.logoKey)}
            initials={initialsOf(detail.name)}
            meta={[kinds(detail.kind), detail.district?.name, detail.address].filter(Boolean).join(" · ")}
            state={detail.owner.status === "BLOCKED" ? "BLOCKED" : detail.status}
            photos={detail.docs.filter((d) => d.kind === "PHOTO").map((d) => `/api/admin/fayl/hujjat/${d.id}`)}
            docs={detail.docs.filter((d) => d.kind !== "PHOTO").map((d) => ({ id: d.id, name: d.fileName, url: `/api/admin/fayl/hujjat/${d.id}` }))}
            rows={rows}
            nextHref={nextHref}
          />
        ) : null}
      </div>
      {detail ? (
        <section className="mt-3 flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5" aria-label={ts("partners.info")}>
          <h3 className="m-0 text-16 font-extrabold">{ts("partners.info")}</h3>
          <p className="m-0 text-13 text-muted">{t("editHint")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-16 bg-surface text-12 text-muted">
              {businessLogoUrl(detail.id, detail.logoKey) ? (
                // eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili
                <img src={businessLogoUrl(detail.id, detail.logoKey)!} alt={ts("partners.logo")} className="size-full object-cover" />
              ) : (
                ts("partners.noLogo")
              )}
            </div>
            <UploadButton query={`tur=logo&biznes=${detail.id}`} label={ts("partners.upload")} testId="logo-upload" />
            {detail.docs.filter((d) => d.kind === "PHOTO").length < 3 ? <UploadButton query={`tur=foto&biznes=${detail.id}`} label={tb("photos.upload")} testId="photo-upload" /> : null}
          </div>
          <BusinessAdminForm
            key={detail.id}
            kindLabels={Object.fromEntries(BUSINESS_KINDS.map((k) => [k, kinds(k)]))}
            business={{
              id: detail.id,
              name: detail.name,
              legalName: detail.legalName ?? "",
              tin: detail.tin ?? "",
              kind: detail.kind,
              typeLabel: detail.typeLabel ?? "",
              address: detail.address,
              landmark: detail.landmark ?? "",
              lat: detail.lat?.toString() ?? "",
              lng: detail.lng?.toString() ?? "",
              workingHours: detail.workingHours,
              description: detail.description ?? "",
              contactName: detail.contactName ?? "",
              contactPhone: detail.contactPhone ?? "",
              publicPhone: detail.publicPhone ?? "",
              telegram: detail.telegram ?? "",
              instagram: detail.instagram ?? "",
            }}
          />
        </section>
      ) : null}
      {detail ? (
        <>
          <ContactNotes
            businessId={detail.id}
            today={todayIso}
            notes={notes.map((n) => ({ id: n.id, contacted: n.contacted, date: dotDate(new Date(n.contactedAt.getTime() - TASHKENT_MS)), note: n.note, admin: n.admin }))}
          />
          <ChangesLog rows={changes.map((c) => ({ id: c.id, role: c.role, actor: c.actor, field: c.field, oldValue: c.oldValue, newValue: c.newValue, at: dotDateTime(c.createdAt) }))} />
        </>
      ) : null}
    </AdminShell>
  );
}

// Dinamik qism (cookie, so'rov parametrlari) sahifaning o'z Suspense chegarasida: mijoz tomonidagi o'tishda
// umumiy layout'dagi chegara ishlamaydi.
async function BusinessesPageContent({ searchParams }: PageProps<"/[locale]/admin/bizneslar">) {
  const { id } = await searchParams;
  return typeof id === "string" && id ? <BusinessCardContent id={id} /> : <BusinessListContent searchParams={searchParams} />;
}

export default function BusinessReviewPage(props: PageProps<"/[locale]/admin/bizneslar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BusinessesPageContent {...props} />
    </Suspense>
  );
}
