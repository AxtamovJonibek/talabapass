import { useTranslations } from "next-intl";
import { DealBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { formatMinute, toTashkent } from "@/lib/time";
import type { CouponView } from "@/server/coupons/coupons";
import { StudentBottomNav } from "../app-chrome";

/** Faol kuponlar ro'yxati (bir nechta bo'lsa) yoki bo'sh holat. Dizaynda chizilmagan — T7 uslubida. */
export function CouponList({ coupons }: { coupons: CouponView[] }) {
  const t = useTranslations("coupon");
  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex-1 overflow-y-auto px-5 pt-[58px] pb-5">
        <h1 className="m-0 text-30 font-black tracking-[-0.03em] font-stretch-112%">{t("listTitle")}</h1>
        {coupons.length === 0 ? (
          <div className="mt-6 flex flex-col items-start gap-3 rounded-16 bg-white p-5">
            <b className="text-16">{t("emptyTitle")}</b>
            <p className="m-0 text-14 leading-[1.45] text-muted">{t("emptyText")}</p>
            <ButtonLink href="/chegirmalar" variant="blue" size="md">
              {t("toDeals")}
            </ButtonLink>
          </div>
        ) : (
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
            {coupons.map((c) => (
              <li key={c.id}>
                <Link href={`/kuponlar/${c.id}`} className="flex items-center gap-3 rounded-16 bg-white px-3.5 py-3 text-ink no-underline">
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
      </div>
      <StudentBottomNav active="coupons" coupons={coupons.length} />
    </div>
  );
}
