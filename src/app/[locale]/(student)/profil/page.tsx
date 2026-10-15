import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { ProfileScreen } from "@/components/student/profile/profile-screen";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCouponCount } from "@/server/coupons/coupons";
import { districtOptions, studentTotals } from "@/server/student/profile";
import { profileData } from "@/server/student/profile-data";

// T8 / WT4 — profil: ID karta, jami tejalgan, sozlamalar (bildirishnoma, til), shaxsiy ma'lumotlar, chiqish
async function ProfileContent() {
  await connection();
  const user = await requireActiveStudent();
  const [profile, totals, coupons, districts] = await Promise.all([profileData(user), studentTotals(user.id), activeCouponCount(user.id), districtOptions()]);
  return <ProfileScreen profile={profile} totals={totals} coupons={coupons} districts={districts} />;
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}
