import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { PhoneOrWeb } from "@/components/student/responsive";
import { StatusDesktop } from "@/components/student/status-desktop";
import { StatusScreen } from "@/components/student/status-screen";
import { redirect } from "@/i18n/navigation";
import { formatMinute, toTashkent } from "@/lib/time";
import { requireStudent } from "@/server/auth/student";
import { studentPathFor } from "@/server/auth/student-status";
import { formatFileSize } from "@/server/storage/file-rules";
import { latestVerification } from "@/server/student/verification";

const DAY_MS = 86_400_000;

// T3 / WT1 (3-qadam) — tekshiruv holati
async function StudentReviewPageContent() {
  const user = await requireStudent();
  const { status } = user.student;
  const locale = await getLocale();
  if (status !== "PENDING" && status !== "REJECTED") return redirect({ href: studentPathFor(status), locale });

  const verification = await latestVerification(user.id);
  if (!verification) return redirect({ href: "/talaba/guvohnoma", locale });

  const t = await getTranslations();
  const course = user.student.course;
  const courseLabel = course === "MASTER" ? t("onboarding.status.master") : t("course.nth", { n: course.slice(1) });

  const sent = toTashkent(verification.createdAt);
  const daysAgo = Math.round((toTashkent(new Date()).date.getTime() - sent.date.getTime()) / DAY_MS);
  const time = formatMinute(sent.minute);
  const sentAt =
    daysAgo === 0
      ? t("onboarding.status.today", { time })
      : daysAgo === 1
        ? t("onboarding.status.yesterday", { time })
        : `${String(sent.date.getUTCDate()).padStart(2, "0")}.${String(sent.date.getUTCMonth() + 1).padStart(2, "0")}, ${time}`;

  const rejected = status === "REJECTED" ? { reason: verification.rejectReason ?? "" } : undefined;

  return (
    <PhoneOrWeb
      phone={
        <StatusScreen
          name={[user.firstName, user.lastName].filter(Boolean).join(" ")}
          meta={`${user.student.university.shortName} · ${courseLabel}`}
          file={`${verification.fileName} · ${formatFileSize(verification.fileSize)}`}
          sentAt={sentAt}
          rejected={rejected}
        />
      }
      web={<StatusDesktop sentAt={sentAt} queuePosition={verification.queuePosition} rejected={rejected} />}
    />
  );
}

// Dinamik qism (cookie, so'rov parametrlari) sahifaning o'z Suspense chegarasida: mijoz tomonidagi o'tishda
// umumiy layout'dagi chegara ishlamaydi.
export default function StudentReviewPage() {
  return (
    <Suspense fallback={null}>
      <StudentReviewPageContent />
    </Suspense>
  );
}
