import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { CashiersPage } from "@/components/business/owner-pages";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { ownerCashiers } from "@/server/business/cashiers";
import { ownerBusinessForDiscounts } from "@/server/business/discounts";

async function Cashiers() {
  const user = await requireRole("BUSINESS_OWNER");
  if (!(await ownerBusinessForDiscounts(user.id))) return redirect({ href: "/biznes", locale: await getLocale() });
  return <CashiersPage cashiers={await ownerCashiers(user.id)} />;
}

// Kassirlar — taklif qilish va o'chirish (B5 bloki)
export default async function BusinessCashiersPage({ params }: PageProps<"/[locale]/biznes/kassirlar">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={null}>
      <Cashiers />
    </Suspense>
  );
}
