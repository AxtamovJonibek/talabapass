import { useTranslations } from "next-intl";
import { DealBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { formatMinute, toTashkent } from "@/lib/time";
import type { CouponView } from "@/server/coupons/coupons";
import { StudentBottomNav, StudentWebNav } from "../app-chrome";
import { PhoneOrWeb } from "../responsive";

/**
 * Bo'sh holat — yirtiladigan chipta ko'rinishida: yuqorida sarlavha va izoh, ikki yonida teshik va uzuq chiziq,
 * "yirtiladigan" qismida harakat. Dizaynda chizilmagan — FeedCard/CouponTicket chipta geometriyasidan.
 */
function EmptyTicket() {
  const t = useTranslations("coupon");
  return (
    <div className="relative mt-6 rounded-22 bg-white">
      <div className="flex flex-col gap-2 px-5 pt-5 pb-[18px]">
        <h2 className="m-0 text-22 leading-[1.05] font-extrabold tracking-[-0.02em] font-stretch-108%">{t("emptyTitle")}</h2>
        <p className="m-0 text-14 leading-[1.45] text-muted">{t("emptyText")}</p>
      </div>
      <div aria-hidden="true" className="relative">
        <div className="border-t-hair-dashed mx-[18px] border-t-2" />
        <span className="absolute top-1/2 -left-[11px] size-[22px] -translate-y-1/2 rounded-full bg-paper" />
        <span className="absolute top-1/2 -right-[11px] size-[22px] -translate-y-1/2 rounded-full bg-paper" />
      </div>
      <div className="px-5 pt-[18px] pb-5">
        <ButtonLink href="/chegirmalar" variant="blue" size="card" block spread>
          {t("toDeals")}
          <Icon name="arrowRight" size={20} />
        </ButtonLink>
      </div>
    </div>
  );
}

function Coupons({ coupons }: { coupons: CouponView[] }) {
  const t = useTranslations("coupon");
  return (
    <>
      <h1 className="m-0 text-30 font-black tracking-[-0.03em] font-stretch-112%">{t("listTitle")}</h1>
      {coupons.length === 0 ? (
        <EmptyTicket />
      ) : (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
          {coupons.map((c) => (
            <li key={c.id}>
              <Link
                href={`/kuponlar/${c.id}`}
                className="flex items-center gap-3 rounded-16 bg-white px-3.5 py-3 text-ink no-underline transition-[scale] duration-150 ease-out active:scale-[0.98]"
              >
                <DealBadge size="sm">{c.badge}</DealBadge>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="truncate text-14">{c.title}</b>
                  <span className="text-12 text-muted">{c.store}</span>
                </span>
                <span className="font-mono text-12 text-muted">{t("until", { time: formatMinute(toTashkent(new Date(c.expiresAt)).minute) })}</span>
                <Icon name="chevronRight" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Faol kuponlar ro'yxati (bir nechta bo'lsa) yoki bo'sh holat. Dizaynda chizilmagan — T7 uslubida; vebda WT4 sarlavhasi bilan. */
export function CouponList({ coupons }: { coupons: CouponView[] }) {
  return (
    <PhoneOrWeb
      phone={
        <div className="flex h-dvh flex-col bg-paper text-ink">
          <div className="flex-1 overflow-y-auto px-5 pt-[58px] pb-5">
            <Coupons coupons={coupons} />
          </div>
          <StudentBottomNav active="coupons" coupons={coupons.length} />
        </div>
      }
      web={
        <div className="min-h-dvh bg-paper text-ink">
          <StudentWebNav />
          <div className="mx-auto max-w-[560px] px-5 pt-10 pb-[60px]">
            <Coupons coupons={coupons} />
          </div>
        </div>
      }
    />
  );
}
