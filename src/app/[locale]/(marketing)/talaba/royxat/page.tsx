import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { RegisterScreen } from "@/components/student/register-screen";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { getCurrentUser, getVerifiedPhone, homePathFor } from "@/server/auth/session";
import { effectiveStudentStatus, studentPathFor } from "@/server/auth/student-status";
import { db } from "@/server/db";

async function Register() {
  const user = await getCurrentUser();
  if (user) {
    const href = user.student
      ? studentPathFor(effectiveStudentStatus(user.student.status, user.student.cardExpiresAt, new Date()))
      : homePathFor(user.role);
    redirect({ href, locale: await getLocale() });
  }
  const [universities, verifiedPhone] = await Promise.all([
    db.university.findMany({ where: { active: true, kind: { not: "OTHER" } }, orderBy: { name: "asc" }, select: { id: true, name: true, shortName: true, region: true, kind: true } }),
    getVerifiedPhone(),
  ]);
  return <RegisterScreen universities={universities} verifiedPhone={verifiedPhone} />;
}

// T1 / WT1 — talaba ro'yxati, 1-qadam
export default async function StudentRegisterPage({ params }: PageProps<"/[locale]/talaba/royxat">) {
  await resolveLocale(params);

  return (
    <Suspense fallback={null}>
      <Register />
    </Suspense>
  );
}
