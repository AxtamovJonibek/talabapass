import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { CouponList } from "@/components/student/coupon/coupon-list";
import { redirect } from "@/i18n/navigation";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCoupons } from "@/server/coupons/coupons";

// "Kuponlar": bitta faol kupon bo'lsa — darhol uning QR'i (T6); bir nechta — ro'yxat; yo'q — bo'sh holat.
async function CouponsPageContent() {
  const user = await requireActiveStudent();
  const coupons = await activeCoupons(user.id);
  if (coupons.length === 1) return redirect({ href: `/kuponlar/${coupons[0]!.id}`, locale: await getLocale() });
  return <CouponList coupons={coupons} />;
}

export default function StudentCouponsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CouponsPageContent />
    </Suspense>
  );
}
