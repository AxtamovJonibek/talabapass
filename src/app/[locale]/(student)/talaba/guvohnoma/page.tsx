import { getLocale } from "next-intl/server";
import { CaptureScreen } from "@/components/student/capture-screen";
import { redirect } from "@/i18n/navigation";
import { requireStudent } from "@/server/auth/student";
import { canUploadCard } from "@/server/auth/student-status";

// T2 — guvohnomani suratga olish yoki yuklash
export default async function StudentCardPage() {
  const user = await requireStudent();
  const { status } = user.student;
  if (!canUploadCard(status)) redirect({ href: "/chegirmalar", locale: await getLocale() });

  const hasSubmission = status === "PENDING" || status === "REJECTED";
  return <CaptureScreen backHref={hasSubmission ? "/talaba/tekshiruv" : "/"} expired={status === "EXPIRED"} />;
}
