import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { QueuePanel, ReviewHeader, type CheckRow, type QueueItem } from "@/components/admin/review-parts";
import { StudentReview } from "@/components/admin/student-review";
import { formatPhone, initials } from "@/lib/format";
import { toTashkent } from "@/lib/time";
import { reviewStats, studentDetail, studentQueue } from "@/server/admin/review";
import { ageLabel, averageWait } from "@/server/admin/review-rules";
import { requireRole } from "@/server/auth/session";
import { formatFileSize } from "@/server/storage/file-rules";

// A2 — talabalar tekshiruvi
async function StudentReviewPageContent({ searchParams }: PageProps<"/[locale]/admin/talabalar">) {
  const admin = await requireRole("ADMIN");
  const [t, tc] = await Promise.all([getTranslations("admin.review"), getTranslations("course")]);
  const { id } = await searchParams;
  const now = new Date();
  const courseLabel = (course: string) => (course === "MASTER" ? tc("MASTER_long") : tc("nth", { n: course.slice(1) }));

  const [queue, stats] = await Promise.all([studentQueue(), reviewStats("students")]);
  const selectedId = typeof id === "string" ? id : (queue.items[0]?.id ?? null);
  const detail = selectedId ? await studentDetail(selectedId) : null;

  const agoText = (date: Date) => {
    const a = ageLabel(date, now);
    return t(`ago.${a.unit}`, { n: a.value });
  };
  const items: QueueItem[] = queue.items.map((v) => {
    const { user, university, faculty, course } = v.student;
    const rejectedBefore = v.student.verifications.length > 0;
    const renewal = Boolean(v.student.cardNumber);
    return {
      id: v.id,
      href: `/admin/talabalar?id=${v.id}`,
      initials: initials(user.firstName, user.lastName),
      name: [user.firstName, user.lastName].filter(Boolean).join(" "),
      ago: agoText(v.createdAt),
      meta: [university.shortName, faculty, courseLabel(course)].filter(Boolean).join(" · "),
      flag: rejectedBefore ? t("flags.resubmitted") : renewal ? t("flags.renewal") : t("flags.fresh"),
      flagTone: rejectedBefore ? "warn" : renewal ? "ok" : "muted",
    };
  });

  // Qarordan keyin: navbatdagi keyingi ariza (yoki boshidagisi)
  const position = queue.items.findIndex((v) => v.id === selectedId);
  const next = queue.items[position + 1] ?? queue.items.find((v) => v.id !== selectedId);
  const nextHref = next ? `/admin/talabalar?id=${next.id}` : "/admin/talabalar";
  const wait = averageWait(stats.reviewed);

  return (
    <AdminShell user={admin} active="students">
      <ReviewHeader
        title={t("studentsTitle")}
        sub={t("studentsSub")}
        approvedToday={stats.approvedToday}
        wait={wait ? t("wait", { hours: wait.hours, minutes: wait.minutes }) : t("waitNone")}
      />
      <div className="flex flex-wrap items-start gap-3">
        <QueuePanel items={items} selectedId={selectedId} more={Math.max(0, queue.total - items.length)} />
        {detail ? (
          <StudentReview
            key={detail.id}
            verificationId={detail.id}
            code={t("sentAgo", { code: `ARIZA-T-${detail.id.slice(-6).toUpperCase()}`, ago: agoText(detail.createdAt) })}
            name={[detail.student.user.firstName, detail.student.user.lastName].filter(Boolean).join(" ")}
            meta={[detail.student.university.name, detail.student.faculty, courseLabel(detail.student.course)].filter(Boolean).join(" · ")}
            state={detail.student.user.status === "BLOCKED" ? "BLOCKED" : detail.status}
            fileUrl={`/api/admin/fayl/guvohnoma/${detail.id}`}
            isPdf={detail.mime === "application/pdf"}
            fileCaption={`${detail.fileName} · ${formatFileSize(detail.fileSize)}`}
            knownCardNumber={detail.student.cardNumber}
            rows={
              [
                { key: "name", label: t("fields.name"), value: [detail.student.user.firstName, detail.student.user.lastName].join(" "), check: t("checks.none"), tone: "muted" },
                { key: "university", label: t("fields.university"), value: detail.student.university.shortName, check: t("checks.none"), tone: "muted" },
                { key: "course", label: t("fields.course"), value: courseLabel(detail.student.course), check: t("checks.none"), tone: "muted" },
                { key: "phone", label: t("fields.phone"), value: formatPhone(detail.student.user.phone), check: t("checks.smsVerified"), tone: "ok" },
              ] satisfies CheckRow[]
            }
            nextHref={nextHref}
            todayIso={toTashkent(now).date.toISOString().slice(0, 10)}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}

// Dinamik qism (cookie, so'rov parametrlari) sahifaning o'z Suspense chegarasida: mijoz tomonidagi o'tishda
// umumiy layout'dagi chegara ishlamaydi.
export default function StudentReviewPage(props: PageProps<"/[locale]/admin/talabalar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudentReviewPageContent {...props} />
    </Suspense>
  );
}
