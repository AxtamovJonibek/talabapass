import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { OrderList, OrdersFrame } from "@/components/student/orders/order-views";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCouponCount } from "@/server/coupons/coupons";
import { studentOrders } from "@/server/preorder/views";

// "Mening buyurtmalarim" — oldindan band qilingan buyurtmalar (dizaynda chizilmagan, mavjud primitivlardan)
async function OrdersContent() {
  const user = await requireActiveStudent();
  const [orders, coupons, t] = await Promise.all([studentOrders(user.id), activeCouponCount(user.id), getTranslations("orders")]);
  return (
    <OrdersFrame title={t("title")} back={{ href: "/profil", label: t("back") }} coupons={coupons}>
      <OrderList orders={orders} />
    </OrdersFrame>
  );
}

export default function StudentOrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrdersContent />
    </Suspense>
  );
}
