import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { DiscountReview } from "@/components/admin/discount-review";
import { QueuePanel, ReviewHeader, type CheckRow, type QueueItem } from "@/components/admin/review-parts";
import type { IconName } from "@/components/ui/icons";
import { discountTerms, PERCENT_MAX, PERCENT_MIN, weekdaysLabel } from "@/lib/discount";
import { formatSom } from "@/lib/format";
import { formatMinute } from "@/lib/time";
import { discountDetail, discountQueue } from "@/server/admin/discount-review";
import { ageLabel } from "@/server/admin/review-rules";
import { requireRole } from "@/server/auth/session";

const dmy = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");

// Admin — chegirmalar navbati (dizaynda yo'q; A2 andozasida)
async function DiscountReviewPageContent({ searchParams }: PageProps<"/[locale]/admin/chegirmalar">) {
  const admin = await requireRole("ADMIN");
  const [t, types, weekday, editor, common] = await Promise.all([
    getTranslations("admin.review"),
    getTranslations("discountType"),
    getTranslations("weekday"),
    getTranslations("discountEditor"),
    getTranslations("common"),
  ]);
  const { id } = await searchParams;
  const now = new Date();

  const queue = await discountQueue();
  const selectedId = typeof id === "string" ? id : (queue.items[0]?.id ?? null);
  const detail = selectedId ? await discountDetail(selectedId) : null;
  const som = (n: number | null) => (n === null ? "—" : `${formatSom(n)} ${common("currency")}`);

  const agoText = (date: Date) => {
    const a = ageLabel(date, now);
    return t(`ago.${a.unit}`, { n: a.value });
  };
  const items: QueueItem[] = queue.items.map((d) => ({
    id: d.id,
    href: `/admin/chegirmalar?id=${d.id}`,
    initials: discountTerms(d).badge,
    name: d.title,
    ago: agoText(d.updatedAt),
    meta: `${d.business.name} · ${types(d.type)}`,
    flag: d.business.status !== "APPROVED" ? t("flags.businessPending") : d.reviewedAt ? t("flags.changed") : t("flags.newDiscount"),
    flagTone: d.business.status !== "APPROVED" || d.reviewedAt ? "warn" : "ok",
  }));

  const position = queue.items.findIndex((d) => d.id === selectedId);
  const next = queue.items[position + 1] ?? queue.items.find((d) => d.id !== selectedId);
  const nextHref = next ? `/admin/chegirmalar?id=${next.id}` : "/admin/chegirmalar";

  let rows: CheckRow[] = [];
  let preview = null;
  if (detail) {
    const terms = discountTerms(detail);
    const overnight = detail.toMinute <= detail.fromMinute;
    const days = weekdaysLabel(detail.weekdays, (n) => weekday(`short.${n}` as "short.1"), weekday("everyDay"));
    const cheaper = terms.finalPrice !== null && terms.originalPrice !== null && terms.finalPrice < terms.originalPrice;
    const percentOk = detail.type === "PERCENT" && detail.percent !== null && detail.percent >= PERCENT_MIN && detail.percent <= PERCENT_MAX;
    rows = [
      {
        key: "business",
        label: t("fields.business"),
        value: detail.business.name,
        check: detail.business.status === "APPROVED" ? t("checks.approved") : t("checks.pending"),
        tone: detail.business.status === "APPROVED" ? "ok" : "warn",
      },
      { key: "type", label: t("fields.discountType"), value: types(detail.type), check: t("checks.none"), tone: "muted" },
      { key: "value", label: t("fields.value"), value: terms.badge, check: percentOk ? t("checks.inRange") : t("checks.none"), tone: percentOk ? "ok" : "muted" },
      { key: "original", label: t("fields.originalPrice"), value: som(terms.originalPrice), check: t("checks.none"), tone: "muted" },
      {
        key: "final",
        label: t("fields.finalPrice"),
        value: detail.type === "BOGO" ? editor("bogoFree") : som(terms.finalPrice),
        check: cheaper ? t("checks.belowOriginal") : t("checks.none"),
        tone: cheaper ? "ok" : "muted",
      },
      {
        key: "schedule",
        label: t("fields.schedule"),
        value: `${days} · ${formatMinute(detail.fromMinute)}–${formatMinute(detail.toMinute)}`,
        check: overnight ? t("checks.overnight") : t("checks.none"),
        tone: overnight ? "warn" : "muted",
      },
      { key: "limit", label: t("fields.dailyLimit"), value: editor("dailyLimitValue", { count: detail.dailyLimit }), check: t("checks.none"), tone: "muted" },
      { key: "per", label: t("fields.perStudent"), value: editor(`perStudentOptions.${detail.perStudentLimit}`), check: t("checks.none"), tone: "muted" },
      { key: "period", label: t("fields.period"), value: `${dmy(detail.startsOn)} – ${dmy(detail.endsOn)}`, check: t("checks.none"), tone: "muted" },
      { key: "terms", label: t("fields.terms"), value: detail.terms ?? "—", check: t("checks.none"), tone: "muted" },
    ];
    preview = {
      icon: detail.category.icon as IconName,
      tileColor: detail.category.tileColor,
      inkColor: detail.category.inkColor,
      badge: terms.badge,
      business: detail.business.name,
      price: detail.type === "BOGO" ? (detail.note ?? editor("bogoFree")) : som(terms.finalPrice),
    };
  }

  return (
    <AdminShell user={admin} active="discounts">
      <ReviewHeader title={t("discountsTitle")} sub={t("discountsSub")} approvedToday={queue.approvedToday} wait={t("waitNone")} />
      <div className="flex flex-wrap items-start gap-3">
        <QueuePanel items={items} selectedId={selectedId} more={Math.max(0, queue.total - items.length)} />
        {detail && preview ? (
          <DiscountReview
            key={detail.id}
            discountId={detail.id}
            code={t("sentAgo", { code: `CHEGIRMA-${detail.id.slice(-5).toUpperCase()}`, ago: agoText(detail.updatedAt) })}
            title={detail.title}
            meta={detail.business.address}
            pending={detail.status === "PENDING_REVIEW"}
            stateLabel={detail.status === "PENDING_REVIEW" ? t("state.PENDING_REVIEW") : detail.status === "REJECTED" ? t("state.REJECTED") : t("state.ACTIVE")}
            preview={preview}
            rows={rows}
            nextHref={nextHref}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}

export default function DiscountReviewPage(props: PageProps<"/[locale]/admin/chegirmalar">) {
  return (
    <Suspense fallback={null}>
      <DiscountReviewPageContent {...props} />
    </Suspense>
  );
}
