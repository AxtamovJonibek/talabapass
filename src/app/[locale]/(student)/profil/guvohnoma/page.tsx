import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { CardScreen } from "@/components/student/profile/profile-screen";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCouponCount } from "@/server/coupons/coupons";
import { studentTotals } from "@/server/student/profile";
import { profileData } from "@/server/student/profile-data";

// Talaba guvohnomasi: holat, raqam, amal muddati (faqat ko'rish)
async function CardContent() {
  await connection();
  const user = await requireActiveStudent();
  const [profile, totals, coupons] = await Promise.all([profileData(user), studentTotals(user.id), activeCouponCount(user.id)]);
  return <CardScreen profile={profile} totals={totals} coupons={coupons} districts={[]} />;
}

export default function StudentCardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CardContent />
    </Suspense>
  );
}
