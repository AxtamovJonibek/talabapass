import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Sidebar } from "@/components/ui/sidebar";
import { logoutAction } from "@/server/actions/auth";

export type BusinessSection = "stats" | "discounts" | "sales" | "cashiers" | "scanner" | "profile";

const ITEMS = [
  { key: "stats", href: "/biznes", icon: "chart" },
  { key: "discounts", href: "/biznes/chegirmalar", icon: "ticket" },
  { key: "sales", href: "/biznes/sotuvlar", icon: "receipt" },
  { key: "cashiers", href: "/biznes/kassirlar", icon: "users" },
  { key: "scanner", href: "/biznes/skaner", icon: "scan" },
  { key: "profile", href: "/biznes/profil", icon: "store" },
] as const;

/**
 * Biznes kabinetining veb qobig'i (B6, WB2): qora yon panel, to'q sariq faol band.
 * Ma'lumot so'ramaydi — server va klient sahifalarda bir xil ishlatiladi.
 */
export function BusinessShell({ active, children }: { active: BusinessSection; children: ReactNode }) {
  const t = useTranslations("businessNav");
  const brand = useTranslations("brand");
  const common = useTranslations("common");

  return (
    <div className="@container flex min-h-screen flex-wrap bg-paper text-ink">
      <Sidebar
        accent="orange"
        navLabel={t("label")}
        header={<Logo size={17} chip="white" tag={brand("business")} className="px-2" />}
        items={ITEMS.map((item) => ({ href: item.href, icon: item.icon, label: t(item.key), active: item.key === active }))}
        footer={
          <form action={logoutAction} className="px-1.5">
            <button type="submit" className="flex h-10 items-center gap-2.5 rounded-10 border-0 bg-transparent px-1.5 font-sans text-14 font-semibold text-fog-3 hover:text-white">
              <Icon name="logout" size={18} />
              {common("logout")}
            </button>
          </form>
        }
      />
      <main className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-[18px] px-[clamp(16px,3cqw,40px)] pt-7 pb-12">{children}</main>
    </div>
  );
}
