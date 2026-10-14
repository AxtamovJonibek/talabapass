import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/logo";
import { Sidebar } from "@/components/ui/sidebar";
import { initials } from "@/lib/format";
import { pendingCounts } from "@/server/admin/review";
import type { CurrentUser } from "@/server/auth/session";

export type AdminSection = "overview" | "students" | "businesses" | "transactions" | "notifications";

const ITEMS = [
  { key: "overview", href: "/admin", icon: "grid" },
  { key: "students", href: "/admin/talabalar", icon: "idCard" },
  { key: "businesses", href: "/admin/bizneslar", icon: "store" },
  { key: "transactions", href: "/admin/tranzaksiyalar", icon: "receipt" },
  { key: "notifications", href: "/admin/bildirishnomalar", icon: "bell" },
] as const;

/** Admin paneli qobig'i (A1–A3): qora yon panel + asosiy maydon. Tor ekranda panel tepaga o'raladi. */
export async function AdminShell({ user, active, children }: { user: CurrentUser; active: AdminSection; children: ReactNode }) {
  const t = await getTranslations("admin");
  const brand = await getTranslations("brand");
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
        }))}
        footer={
          <div className="flex items-center gap-2.5 px-1.5">
            <div className="flex size-[34px] items-center justify-center rounded-full bg-paper text-12 font-extrabold text-ink">
              {initials(user.firstName, user.lastName)}
            </div>
            <div className="flex flex-col">
              <span className="text-13 font-bold">{name}</span>
              <span className="text-12 text-fog-3">{t("role")}</span>
            </div>
          </div>
        }
      />
      <main className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-[clamp(16px,3vw,40px)] pt-7 pb-12">{children}</main>
    </div>
  );
}
