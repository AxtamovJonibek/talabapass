import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { connection } from "next/server";
import { getLocale } from "next-intl/server";
import { CouponScreen } from "@/components/student/coupon/coupon-screen";
import { redirect } from "@/i18n/navigation";
import { requireActiveStudent } from "@/server/auth/student";
import { db } from "@/server/db";
import { studentCoupon } from "@/server/coupons/coupons";

// T6 — kupon QR'i. Yopilgan (sotilgan, bekor, eskirgan) kupon — tarix yoki kuponlar ro'yxatiga.
async function CouponPageContent({ params }: { params: PageProps<"/[locale]/kuponlar/[id]">["params"] }) {
  await connection();
  const user = await requireActiveStudent();
  const { id } = await params;
  const locale = await getLocale();
  const coupon = /^[a-z0-9_]{10,40}$/.test(id) ? await studentCoupon(user.id, id) : null;
  if (!coupon) {
    const sold = await db.redemption.findFirst({ where: { couponId: id, studentId: user.id }, select: { id: true } });
    return redirect({ href: sold ? `/tarix?chek=${sold.id}` : "/kuponlar", locale });
  }
  const discount = await db.coupon.findUniqueOrThrow({ where: { id: coupon.id }, select: { discountId: true } });
  return <CouponScreen coupon={coupon} renderedAt={new Date().getTime()} backHref={`/chegirmalar/${discount.discountId}`} />;
}

export default function CouponPage({ params }: PageProps<"/[locale]/kuponlar/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CouponPageContent params={params} />
    </Suspense>
  );
}
