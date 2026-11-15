import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Sidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/server/actions/auth";
import { OwnerBottomNav, type OwnerTab } from "./owner-nav";

export type BusinessSection = "stats" | "orders" | "discounts" | "sales" | "cashiers" | "scanner" | "profile" | "settings" | "notifications";

const ITEMS = [
  { key: "stats", href: "/biznes", icon: "chart" },
  { key: "orders", href: "/biznes/buyurtmalar", icon: "clock" },
  { key: "discounts", href: "/biznes/chegirmalar", icon: "ticket" },
  { key: "sales", href: "/biznes/sotuvlar", icon: "receipt" },
  { key: "cashiers", href: "/biznes/kassirlar", icon: "users" },
  { key: "scanner", href: "/biznes/skaner", icon: "scan" },
  { key: "profile", href: "/biznes/profil", icon: "store" },
  { key: "settings", href: "/biznes/sozlamalar", icon: "gear" },
  { key: "notifications", href: "/biznes/bildirishnomalar", icon: "bell" },
] as const;

/**
 * Biznes kabinetining veb qobig'i (B6, WB2): qora yon panel, to'q sariq faol band.
 * Ma'lumot so'ramaydi — server va klient sahifalarda bir xil ishlatiladi.
 * `phoneTab` berilsa kontent bir marta chiziladi: 700px dan torda yon panel o'rniga pastki navigatsiya (jonli
 * ro'yxat kabi holatli sahifalar — ikki nusxa bo'lib so'rov/signal takrorlanmasin).
 */
export function BusinessShell({ active, phoneTab, children }: { active: BusinessSection; phoneTab?: OwnerTab; children: ReactNode }) {
  const t = useTranslations("businessNav");
  const brand = useTranslations("brand");
  const common = useTranslations("common");

  const sidebar = (
    <Sidebar
      accent="orange"
      navLabel={t("label")}
      header={<Logo size={17} chip="white" tag={brand("business")} className="px-2" />}
      items={ITEMS.map((item) => ({ href: item.href, icon: item.icon, label: t(item.key), active: item.key === active }))}
      footer={
        <form action={logoutAction} className="px-1.5">
          <button type="submit" className="tap flex h-10 items-center gap-2.5 rounded-10 border-0 bg-transparent px-1.5 font-sans text-14 font-semibold text-fog-3 hover:text-white">
            <Icon name="logout" size={18} />
            {common("logout")}
          </button>
        </form>
      }
    />
  );

  return (
    <div className="@container flex min-h-screen flex-wrap bg-paper text-ink">
      {phoneTab ? <div className="hidden @min-[700px]:contents">{sidebar}</div> : sidebar}
      <main className={cn("box-border flex min-w-0 flex-[999_1_560px] flex-col gap-[18px] px-[clamp(16px,3cqw,40px)] pt-7 pb-12", phoneTab && "pb-6 @min-[700px]:pb-12")}>{children}</main>
      {/* sticky, fixed emas: @container (layout containment) fixed'ni ekranga emas, konteynerga bog'laydi */}
      {phoneTab ? (
        <div className="sticky bottom-0 z-20 basis-full self-end @min-[700px]:hidden">
          <OwnerBottomNav active={phoneTab} />
        </div>
      ) : null}
    </div>
  );
}
