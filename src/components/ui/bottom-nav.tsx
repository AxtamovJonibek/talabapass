import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";
import { Icon } from "./icon";
import type { IconName } from "./icons";

export type BottomNavItem = {
  href: string;
  label: ReactNode;
  icon: IconName;
  active?: boolean;
  /** Faol kuponlar soni kabi belgi */
  badge?: ReactNode;
};

type BottomNavProps = {
  items: BottomNavItem[];
  /** light — talaba ilovasi; dark — kassir skaneri */
  tone?: "light" | "dark";
  label: string;
};

/** 84px pastki navigatsiya (T4, B3). */
export function BottomNav({ items, tone = "light", label }: BottomNavProps) {
  const dark = tone === "dark";
  return (
    <nav
      aria-label={label}
      className={cn(
        "box-border grid h-[84px] auto-cols-fr grid-flow-col border-t pb-[18px]",
        dark ? "border-ink-3 bg-ink" : "border-line-soft bg-white",
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            // Bosilganda ikonka biroz kichrayadi
            "relative flex flex-col items-center justify-center gap-1 text-11 no-underline [&>svg]:transition-[scale] [&>svg]:duration-150 [&>svg]:ease-out active:[&>svg]:scale-[0.88]",
            item.active ? "font-bold" : "font-semibold",
            dark ? (item.active ? "text-orange" : "text-fog-3") : item.active ? "text-ink" : "text-muted",
          )}
        >
          {/* Dizaynda faqat "Asosiy" (uy) to'ldiriladi; boshqa faol ikonkalar qalinroq chiziq bilan (T7) */}
          <Icon name={item.icon} size={22} filled={item.active && !dark && item.icon === "home"} strokeWidth={item.active && !dark && item.icon !== "home" ? 2.4 : 2} />
          {item.label}
          {item.badge != null ? (
            <span className="absolute top-2 left-[52%] flex h-4 min-w-4 items-center justify-center rounded-8 bg-orange text-10 font-extrabold text-ink">
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
