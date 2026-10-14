import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { OwnerCashiers } from "@/server/business/cashiers";
import type { OwnerDiscount } from "@/server/business/discounts";
import type { OwnerProfile } from "@/server/business/profile";
import { PhoneOrWeb } from "@/components/student/responsive";
import { BusinessShell, type BusinessSection } from "./business-shell";
import { CashierList } from "./cashier-list";
import { DiscountList } from "./discount-list";
import { OwnerBottomNav, type OwnerTab } from "./owner-nav";
import { ProfileHeader } from "./profile-header";

/** B5 dagi "Chegirmalar" bloki: sarlavha, "+ Yangi", ro'yxat. */
function DiscountsBlock({ discounts }: { discounts: OwnerDiscount[] }) {
  const t = useTranslations("discountList");
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-18 font-extrabold font-stretch-110%">{t("title")}</h2>
        <Link href="/biznes/chegirma/yangi" className="flex h-11 items-center text-14 font-bold text-rust no-underline">
          {t("add")}
        </Link>
      </div>
      <DiscountList discounts={discounts} />
    </div>
  );
}

/** Telefon: kontent + pastki navigatsiya; veb: biznes kabineti qobig'i. */
function OwnerFrame({ tab, section, phone, web }: { tab: OwnerTab; section: BusinessSection; phone: ReactNode; web: ReactNode }) {
  return (
    <PhoneOrWeb
      phone={
        <div className="flex h-dvh flex-col bg-paper text-ink">
          <div className="flex-1 overflow-y-auto">{phone}</div>
          <OwnerBottomNav active={tab} />
        </div>
      }
      web={<BusinessShell active={section}>{web}</BusinessShell>}
    />
  );
}

/** B5 — biznes profili (telefon — dizayn; veb — o'sha bloklar kabinet ichida). */
export function ProfilePage({ profile, discounts, cashiers }: { profile: OwnerProfile; discounts: OwnerDiscount[]; cashiers: OwnerCashiers }) {
  return (
    <OwnerFrame
      tab="profile"
      section="profile"
      phone={
        <>
          <ProfileHeader p={profile} />
          <div className="flex flex-col gap-0 px-4 pt-[18px] pb-5">
            <DiscountsBlock discounts={discounts} />
            <div className="pt-[18px]">
              <CashierList data={cashiers} />
            </div>
          </div>
        </>
      }
      web={
        <>
          <div className="overflow-hidden rounded-18">
            <ProfileHeader p={profile} />
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-[1_1_380px]">
              <DiscountsBlock discounts={discounts} />
            </div>
            <div className="min-w-0 flex-[1_1_320px]">
              <CashierList data={cashiers} />
            </div>
          </div>
        </>
      }
    />
  );
}

/** Kassirlar (B5 bloki alohida sahifada). */
export function CashiersPage({ cashiers }: { cashiers: OwnerCashiers }) {
  return (
    <OwnerFrame
      tab="profile"
      section="cashiers"
      phone={
        <div className="px-4 pt-14 pb-5">
          <CashierList data={cashiers} />
        </div>
      }
      web={
        <div className="max-w-[640px]">
          <CashierList data={cashiers} />
        </div>
      }
    />
  );
}
