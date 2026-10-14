import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/logo";
import { Sidebar } from "@/components/ui/sidebar";
import { Icon } from "@/components/ui/icon";
import { initials } from "@/lib/format";
import { logoutAction } from "@/server/actions/auth";
import { pendingCounts } from "@/server/admin/review";
import type { CurrentUser } from "@/server/auth/session";

export type AdminSection = "overview" | "students" | "businesses" | "transactions" | "notifications";

// ready: false — bo'lim keyingi bosqichlarda quriladi (10-bosqich); panelda xira ko'rinadi.
const ITEMS = [
  { key: "overview", href: "/admin", icon: "grid", ready: false },
  { key: "students", href: "/admin/talabalar", icon: "idCard", ready: true },
  { key: "businesses", href: "/admin/bizneslar", icon: "store", ready: true },
  { key: "transactions", href: "/admin/tranzaksiyalar", icon: "receipt", ready: false },
  { key: "notifications", href: "/admin/bildirishnomalar", icon: "bell", ready: false },
] as const;

/** Admin paneli qobig'i (A1–A3): qora yon panel + asosiy maydon. Tor ekranda panel tepaga o'raladi. */
export async function AdminShell({ user, active, children }: { user: CurrentUser; active: AdminSection; children: ReactNode }) {
  const t = await getTranslations("admin");
  const brand = await getTranslations("brand");
  const common = await getTranslations("common");
  const counts = await pendingCounts();
  const badge = { students: counts.students, businesses: counts.businesses } as Partial<Record<AdminSection, number>>;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <div className="flex min-h-screen flex-wrap bg-admin-bg text-ink">
      <Sidebar
        accent="blue"
        navLabel={t("nav.label")}
        header={<Logo size={17} tag={brand("admin")} tagTone="paper" className="px-2" />}
        items={ITEMS.map((item) => ({
          href: item.href,
          icon: item.icon,
          label: t(`nav.${item.key}`),
          active: item.key === active,
          badge: badge[item.key],
          disabled: !item.ready,
        }))}
        footer={
          <div className="flex items-center gap-2.5 px-1.5">
            <div className="flex size-[34px] items-center justify-center rounded-full bg-paper text-12 font-extrabold text-ink">
              {initials(user.firstName, user.lastName)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-13 font-bold">{name}</span>
              <span className="text-12 text-fog-3">{t("role")}</span>
            </div>
            {/* Dizaynda chiqish tugmasi yo'q — panel pastidagi ism yonida kichik ikonka */}
            <form action={logoutAction}>
              <button type="submit" aria-label={common("logout")} title={common("logout")} className="flex size-8 items-center justify-center rounded-8 border-0 bg-transparent p-0 text-fog-3 hover:text-white">
                <Icon name="logout" size={18} />
              </button>
            </form>
          </div>
        }
      />
      <main className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-[clamp(16px,3vw,40px)] pt-7 pb-12">{children}</main>
    </div>
  );
}
