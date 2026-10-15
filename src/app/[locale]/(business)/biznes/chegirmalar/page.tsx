import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { BusinessShell } from "@/components/business/business-shell";
import { DiscountList } from "@/components/business/discount-list";
import { OwnerBottomNav } from "@/components/business/owner-nav";
import { PhoneOrWeb } from "@/components/student/responsive";
import { ButtonLink } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { ownerBusinessForDiscounts, ownerDiscounts } from "@/server/business/discounts";

async function Discounts() {
  const user = await requireRole("BUSINESS_OWNER");
  if (!(await ownerBusinessForDiscounts(user.id))) return redirect({ href: "/biznes", locale: await getLocale() });
  const [discounts, t] = await Promise.all([ownerDiscounts(user.id), getTranslations("discountList")]);

  return (
    <PhoneOrWeb
      phone={
        <div className="flex min-h-dvh flex-col bg-paper text-ink">
          <div className="flex-1 pt-10">
            <div className="flex items-baseline justify-between px-4 pt-[18px]">
              <h1 className="m-0 text-18 font-extrabold font-stretch-110%">{t("title")}</h1>
              <Link href="/biznes/chegirma/yangi" className="flex h-11 items-center text-14 font-bold text-rust no-underline">
                {t("add")}
              </Link>
            </div>
            <div className="mx-4 mb-5 flex flex-col gap-2">
              <DiscountList discounts={discounts} />
            </div>
          </div>
          <OwnerBottomNav active="discounts" />
        </div>
      }
      web={
        <BusinessShell active="discounts">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="m-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("title")}</h1>
            <ButtonLink href="/biznes/chegirma/yangi" variant="orange" size="md-wide">
              {t("addWeb")}
            </ButtonLink>
          </header>
          <div className="flex max-w-[760px] flex-col gap-2">
            <DiscountList discounts={discounts} />
          </div>
        </BusinessShell>
      }
    />
  );
}

// B5 dagi chegirmalar bloki alohida sahifa sifatida (veb: biznes kabineti ichida)
export default async function DiscountsPage({ params }: PageProps<"/[locale]/biznes/chegirmalar">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Discounts />
    </Suspense>
  );
}
