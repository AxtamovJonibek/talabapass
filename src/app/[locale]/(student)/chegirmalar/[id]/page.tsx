import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DealDetailScreen } from "@/components/student/deal/deal-detail";
import { initials } from "@/lib/format";
import { requireActiveStudent } from "@/server/auth/student";
import { getTranslations } from "next-intl/server";
import { activeCouponFor } from "@/server/coupons/coupons";
import { countView, dealDetail, isSaved } from "@/server/student/feed";
import { currentOrigin } from "@/server/student/location";

// T5 / WT3 — chegirma tafsiloti. Talabaga ko'rinmaydigan chegirma (tasdiqlanmagan, tugagan, biznesi bloklangan) — 404.
async function DealPageContent({ params }: { params: PageProps<"/[locale]/chegirmalar/[id]">["params"] }) {
  const user = await requireActiveStudent();
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) notFound();
  const now = new Date();
  const origin = await currentOrigin();
  const [detail, saved, coupon, t] = await Promise.all([
    dealDetail(id, now, origin?.point ?? null),
    isSaved(user.id, id),
    activeCouponFor(user.id, id),
    getTranslations("dealPage"),
  ]);
  if (!detail) notFound();
  await countView(id, now);

  const soldOut = detail.deal.live && detail.deal.left <= 0;
  const claim = {
    discountId: id,
    available: detail.deal.live && !soldOut,
    unavailableText: soldOut ? t("soldOut") : null,
    coupon,
    renderedAt: now.getTime(),
  };
  return <DealDetailScreen detail={detail} now={now} saved={saved} claim={claim} initials={initials(user.firstName, user.lastName)} />;
}

export default function DealPage({ params }: PageProps<"/[locale]/chegirmalar/[id]">) {
  return (
    <Suspense fallback={null}>
      <DealPageContent params={params} />
    </Suspense>
  );
}
