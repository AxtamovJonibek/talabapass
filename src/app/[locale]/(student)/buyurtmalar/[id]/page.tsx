import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { OrderDetail, OrdersFrame } from "@/components/student/orders/order-views";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCouponCount } from "@/server/coupons/coupons";
import { studentOrder } from "@/server/preorder/views";

// Buyurtma: holat vaqt chizig'i, QR (tasdiqlangach), summalar, bekor qilish. Faqat o'z buyurtmasi (boshqasiniki — 404).
async function OrderContent({ params }: { params: PageProps<"/[locale]/buyurtmalar/[id]">["params"] }) {
  const user = await requireActiveStudent();
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) notFound();
  const [order, coupons, t] = await Promise.all([studentOrder(user.id, id), activeCouponCount(user.id), getTranslations("orders")]);
  if (!order) notFound();
  return (
    <OrdersFrame title={order.businessName} back={{ href: "/buyurtmalar", label: t("back") }} coupons={coupons}>
      <OrderDetail order={order} />
    </OrdersFrame>
  );
}

export default function StudentOrderPage({ params }: PageProps<"/[locale]/buyurtmalar/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderContent params={params} />
    </Suspense>
  );
}
