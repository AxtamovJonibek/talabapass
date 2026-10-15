import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { SalesScreen } from "@/components/business/stats/sales-screen";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { parsePeriod } from "@/lib/stats";
import { requireRole } from "@/server/auth/session";
import { businessSales } from "@/server/business/sales";
import { ownerStatsBusiness } from "@/server/business/stats";

async function Sales({ searchParams }: { searchParams: PageProps<"/[locale]/biznes/sotuvlar">["searchParams"] }) {
  const user = await requireRole("BUSINESS_OWNER");
  const business = await ownerStatsBusiness(user.id);
  // Tasdiqlanmagan biznesda sotuv yo'q — bosh sahifa holatiga qarab o'zi yo'naltiradi
  if (!business) return redirect({ href: "/biznes", locale: await getLocale() });
  const query = await searchParams;
  const period = parsePeriod(query.davr);
  const page = Number(Array.isArray(query.sahifa) ? query.sahifa[0] : query.sahifa) || 1;
  const sales = await businessSales(business.id, period, page);
  return <SalesScreen period={period} sales={sales} />;
}

// "Sotuvlar va cheklar" — davr bo'yicha ro'yxat, har bir chek PDF
export default async function SalesPage({ params, searchParams }: PageProps<"/[locale]/biznes/sotuvlar">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={null}>
      <Sales searchParams={searchParams} />
    </Suspense>
  );
}
