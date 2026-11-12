import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { BusinessShell } from "@/components/business/business-shell";
import { OrdersBoard, SettingsLink } from "@/components/business/preorder/orders-board";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { businessOrders, ownerOrdersBusiness } from "@/server/preorder/views";

// Oldindan band qilingan buyurtmalar: jonli ro'yxat, qabul/rad/tayyor, bugungi hisobot (dizaynda chizilmagan)
async function Orders() {
  const user = await requireRole("BUSINESS_OWNER");
  const business = await ownerOrdersBusiness(user.id);
  if (!business) return redirect({ href: "/biznes", locale: await getLocale() });
  const [initial, t] = await Promise.all([businessOrders(business.id, "new"), getTranslations("businessOrders")]);
  const header = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="m-0 text-30 leading-none font-black tracking-[-0.03em] font-stretch-110%">{t("title")}</h1>
      <SettingsLink />
    </div>
  );
  return (
    <BusinessShell active="orders" phoneTab="orders">
      {header}
      <OrdersBoard initial={initial} initialFilter="new" />
    </BusinessShell>
  );
}

export default async function BusinessOrdersPage({ params }: PageProps<"/[locale]/biznes/buyurtmalar">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Orders />
    </Suspense>
  );
}
