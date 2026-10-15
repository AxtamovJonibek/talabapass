import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { ProfileEditScreen } from "@/components/student/profile/profile-screen";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCouponCount } from "@/server/coupons/coupons";
import { districtOptions, studentTotals } from "@/server/student/profile";
import { profileData } from "@/server/student/profile-data";

// Shaxsiy ma'lumotlar (telefonda alohida ekran; vebda /profil bilan bir xil)
async function ProfileEditContent() {
  await connection();
  const user = await requireActiveStudent();
  const [profile, totals, coupons, districts] = await Promise.all([profileData(user), studentTotals(user.id), activeCouponCount(user.id), districtOptions()]);
  return <ProfileEditScreen profile={profile} totals={totals} coupons={coupons} districts={districts} />;
}

export default function StudentProfileEditPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileEditContent />
    </Suspense>
  );
}
