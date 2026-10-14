import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { db } from "../db";
import { requireRole, type CurrentUser } from "./session";
import { effectiveStudentStatus, studentPathFor } from "./student-status";

export type StudentUser = CurrentUser & { student: NonNullable<CurrentUser["student"]> };

/**
 * Kirgan talaba va uning haqiqiy holati. Guvohnoma muddati o'tgan bo'lsa shu yerning o'zida EXPIRED ga
 * o'tkaziladi — cron'ga tayanilmaydi.
 */
export async function requireStudent(): Promise<StudentUser> {
  const user = await requireRole("STUDENT");
  if (!user.student) return redirect({ href: "/talaba/royxat", locale: await getLocale() });

  const status = effectiveStudentStatus(user.student.status, user.student.cardExpiresAt, new Date());
  if (status !== user.student.status) {
    await db.studentProfile.updateMany({ where: { userId: user.id, status: "APPROVED" }, data: { status } });
    user.student.status = status;
  }
  return user as StudentUser;
}

/** Ilova sahifalari uchun: faqat tasdiqlangan talaba. Qolganlar o'z qadamiga yo'naltiriladi. */
export async function requireActiveStudent(): Promise<StudentUser> {
  const user = await requireStudent();
  if (user.student.status !== "APPROVED") {
    return redirect({ href: studentPathFor(user.student.status), locale: await getLocale() });
  }
  return user;
}
