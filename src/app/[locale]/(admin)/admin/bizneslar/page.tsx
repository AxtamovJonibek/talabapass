import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { BusinessReview } from "@/components/admin/business-review";
import { BusinessAdminForm } from "@/components/admin/manage/forms";
import { UploadButton } from "@/components/admin/super/controls";
import { QueuePanel, ReviewHeader, type CheckRow, type QueueItem } from "@/components/admin/review-parts";
import { BUSINESS_KINDS } from "@/lib/business";
import { formatContact, formatPhone } from "@/lib/format";
import { businessLogoUrl } from "@/lib/profile-image";
import { businessDetail, businessQueue, reviewStats } from "@/server/admin/review";
import { ageLabel, averageWait } from "@/server/admin/review-rules";
import { requireRole } from "@/server/auth/session";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

// A2 (biznes) — bizneslar tekshiruvi
async function BusinessReviewPageContent({ searchParams }: PageProps<"/[locale]/admin/bizneslar">) {
  const admin = await requireRole("ADMIN");
  const [t, kinds, ts] = await Promise.all([getTranslations("admin.review"), getTranslations("businessKind"), getTranslations("adminSuper")]);
  const { id } = await searchParams;
  const now = new Date();

  const [queue, stats] = await Promise.all([businessQueue(), reviewStats("businesses")]);
  const selectedId = typeof id === "string" ? id : (queue.items[0]?.id ?? null);
  const detail = selectedId ? await businessDetail(selectedId) : null;

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
    </AdminShell>
  );
}

// Dinamik qism (cookie, so'rov parametrlari) sahifaning o'z Suspense chegarasida: mijoz tomonidagi o'tishda
// umumiy layout'dagi chegara ishlamaydi.
export default function BusinessReviewPage(props: PageProps<"/[locale]/admin/bizneslar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BusinessReviewPageContent {...props} />
    </Suspense>
  );
}
