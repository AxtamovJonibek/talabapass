import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { BusinessReview } from "@/components/admin/business-review";
import { QueuePanel, ReviewHeader, type CheckRow, type QueueItem } from "@/components/admin/review-parts";
import { formatPhone } from "@/lib/format";
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
  const [t, kinds] = await Promise.all([getTranslations("admin.review"), getTranslations("businessKind")]);
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
      name: b.name,
      ago: agoText(b.createdAt),
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
          value: detail.contactPhone ? formatPhone(detail.contactPhone) : formatPhone(detail.owner.phone),
          check: t("checks.smsVerified"),
          tone: "ok",
        },
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
            code={t("sentAgo", { code: `ARIZA-B-${detail.id.slice(-5).toUpperCase()}`, ago: agoText(detail.createdAt) })}
            name={detail.name}
            meta={[kinds(detail.kind), detail.district?.name, detail.address].filter(Boolean).join(" · ")}
            state={detail.owner.status === "BLOCKED" ? "BLOCKED" : detail.status}
            photos={detail.docs.filter((d) => d.kind === "PHOTO").map((d) => `/api/admin/fayl/hujjat/${d.id}`)}
            docs={detail.docs.filter((d) => d.kind !== "PHOTO").map((d) => ({ id: d.id, name: d.fileName, url: `/api/admin/fayl/hujjat/${d.id}` }))}
            rows={rows}
            nextHref={nextHref}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}

// Dinamik qism (cookie, so'rov parametrlari) sahifaning o'z Suspense chegarasida: mijoz tomonidagi o'tishda
// umumiy layout'dagi chegara ishlamaydi.
export default function BusinessReviewPage(props: PageProps<"/[locale]/admin/bizneslar">) {
  return (
    <Suspense fallback={null}>
      <BusinessReviewPageContent {...props} />
    </Suspense>
  );
}
