import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export type StudentTab = "home" | "coupons" | "history" | "profile";

/** T4 pastki navigatsiyasi (talaba, telefon). `coupons` — faol kuponlar soni (belgi). */
export function StudentBottomNav({ active, coupons = 0 }: { active: StudentTab; coupons?: number }) {
  const t = useTranslations("studentNav");
  const feed = useTranslations("feed");
  return (
    <BottomNav
      label={feed("nav")}
      items={[
        { href: "/chegirmalar", icon: "home", label: t("home"), active: active === "home" },
        { href: "/kuponlar", icon: "ticket", label: t("coupons"), active: active === "coupons", badge: coupons > 0 ? coupons : undefined },
        { href: "/tarix", icon: "clock", label: t("history"), active: active === "history" },
        { href: "/profil", icon: "user", label: t("profile"), active: active === "profile" },
      ]}
    />
  );
}

/** WT2 / WT3 sarlavhasi: logo + o'rtadagi bloklar + profil doirasi. Ota element `@container`. */
export function StudentWebHeader({ sticky = false, initials, children }: { sticky?: boolean; initials: string; children?: ReactNode }) {
  const t = useTranslations("feed");
  return (
    <header className={cn("border-0 border-b-[1.5px] border-solid border-ink bg-paper", sticky && "sticky top-0 z-10")}>
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center gap-3.5 px-[clamp(16px,3cqw,40px)]">
        <Link href="/chegirmalar" className="shrink-0 text-ink no-underline">
          <Logo size={20} />
        </Link>
        {children}
        <Link
          href="/profil"
          aria-label={t("profile")}
          className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-blue text-14 font-extrabold text-white no-underline"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}

/** Bildirishnomalar qo'ng'irog'i: o'qilmagani bo'lsa to'q sariq nuqta (T4 — 44px, WT2 — 46px). Bosilsa xabarlar ro'yxati. */
export function BellButton({ unread, size = "md" }: { unread: boolean; size?: "md" | "lg" }) {
  const t = useTranslations("feed");
  return (
    <Link
      href="/bildirishnomalar"
      aria-label={t("notifications")}
      className={cn("relative flex shrink-0 items-center justify-center rounded-full bg-white text-ink no-underline", size === "md" ? "size-11" : "size-[46px]")}
    >
      <Icon name="bell" size={20} />
      {unread ? (
        <span className={cn("absolute size-3 rounded-full border-2 border-solid border-white bg-orange", size === "md" ? "top-2.5 right-[11px]" : "top-[11px] right-3")} />
      ) : null}
    </Link>
  );
}

/** WT4 (tarix) va profil sahifalari sarlavhasi: logo + "Chegirmalar" / "Profil va tarix" navigatsiyasi. Ota element `@container`. */
export function StudentWebNav({ active }: { active: "deals" | "profile" }) {
  const t = useTranslations();
  const base = "flex h-10 items-center rounded-10 px-3 text-14 whitespace-nowrap no-underline";
  return (
    <header className="border-0 border-b-[1.5px] border-solid border-ink">
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center gap-3.5 px-[clamp(16px,3cqw,40px)]">
        <Link href="/chegirmalar" className="shrink-0 text-ink no-underline">
          <Logo size={20} />
        </Link>
        <nav aria-label={t("feed.nav")} className="ml-auto flex gap-0.5 overflow-x-auto">
          <Link href="/chegirmalar" aria-current={active === "deals" ? "page" : undefined} className={cn(base, active === "deals" ? "bg-ink font-bold text-white" : "font-semibold text-ink")}>
            {t("feed.navDeals")}
          </Link>
          <Link href="/tarix" aria-current={active === "profile" ? "page" : undefined} className={cn(base, active === "profile" ? "bg-ink font-bold text-white" : "font-semibold text-ink")}>
            {t("history.navProfile")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
