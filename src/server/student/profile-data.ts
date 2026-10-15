import "server-only";
import { getTranslations } from "next-intl/server";
import type { ProfileData } from "@/components/student/profile/profile-parts";
import { initials } from "@/lib/format";
import { studentAvatarUrl } from "@/lib/profile-image";
import type { StudentUser } from "../auth/student";

/** Profil ekranlari uchun tayyor ma'lumot (karta, forma boshlang'ich qiymatlari). */
export async function profileData(user: StudentUser): Promise<ProfileData> {
  const t = await getTranslations();
  const s = user.student;
  const course = s.course === "MASTER" ? t("coupon.master") : t("coupon.course", { n: s.course.slice(1) });
  return {
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    initials: initials(user.firstName, user.lastName),
    avatarUrl: studentAvatarUrl(user.id, s.avatarKey),
    meta: [s.university.shortName, s.faculty, course].filter(Boolean).join(" · "),
    publicId: s.publicId,
    cardExpiresAt: s.cardExpiresAt?.toISOString() ?? null,
    cardNumber: s.cardNumber,
    notify: s.notifyDeals,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    faculty: s.faculty ?? "",
    course: s.course,
    districtId: s.districtId ?? "",
  };
}
