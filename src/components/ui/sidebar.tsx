import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";
import { Icon } from "./icon";
import type { IconName } from "./icons";

export type SidebarItem = {
  href: string;
  label: ReactNode;
  icon: IconName;
  active?: boolean;
  count?: ReactNode;
  /** To'q sariq hisoblagich: navbatdagi arizalar soni (A2) */
  badge?: ReactNode;
  /** Hali tayyor bo'lmagan bo'lim: xira, bosilmaydi */
  disabled?: boolean;
};

type SidebarProps = {
  /** Faol band rangi: biznes — to'q sariq, admin — ko'k */
  accent: "orange" | "blue";
  header: ReactNode;
  items: SidebarItem[];
  navLabel: string;
  footer?: ReactNode;
};

/**
 * Qora yon panel (B6, A1). `flex: 1 1 220px` — tor ekranda dizayndagidek tabiiy ravishda tepaga o'raladi.
 * Ota element: `@container flex flex-wrap`. Kontent yonida turganda (konteyner ≥ 780px = 220 + 560, o'ralish chegarasi)
 * panel qotadi: `sticky top-0 h-dvh` — tepada logo, o'rtada menyu (sig'masa o'zi skroll bo'ladi), pastda "Hisobdan chiqish"
 * doim ko'rinadi; sahifaning o'zi (o'ng tomon) oyna bilan skroll bo'ladi, ichidagi sticky elementlar o'zgarmaydi.
 */
export function Sidebar({ accent, header, items, navLabel, footer }: SidebarProps) {
  return (
    <aside
      className="box-border flex max-w-full flex-[1_1_220px] flex-col gap-[22px] bg-ink px-4 py-6 text-paper @min-[780px]:sticky @min-[780px]:top-0 @min-[780px]:z-30 @min-[780px]:h-dvh @min-[780px]:self-start"
      data-testid="sidebar"
    >
      <div className="shrink-0">{header}</div>
      <nav aria-label={navLabel} className="flex flex-col gap-0.5 @min-[780px]:-mx-1 @min-[780px]:min-h-0 @min-[780px]:flex-1 @min-[780px]:overflow-y-auto @min-[780px]:overscroll-contain @min-[780px]:px-1">
        {items.map((item) =>
          item.disabled ? (
            <span
              key={item.href}
              aria-disabled="true"
              className="flex h-[42px] cursor-not-allowed items-center gap-2.5 rounded-10 px-3 text-14 font-semibold text-fog-1 opacity-40"
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </span>
          ) : (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "tp-row flex h-[42px] items-center gap-2.5 rounded-10 px-3 text-14 no-underline",
              // A2: hisoblagichli bandlar faol bo'lmasa ham qalin
              item.active || item.badge != null ? "font-bold" : "font-semibold",
              item.active ? (accent === "orange" ? "bg-orange text-ink" : "bg-blue text-white") : "text-fog-1",
            )}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
            {item.badge != null ? (
              <span className="ml-auto rounded-10 bg-orange px-[7px] py-px text-12 font-extrabold text-ink">{item.badge}</span>
            ) : null}
            {item.count != null ? (
              <span className={cn("ml-auto font-mono text-12", item.active ? null : "text-fog-3")}>{item.count}</span>
            ) : null}
          </Link>
          ),
        )}
      </nav>
      {footer ? (
        <div className="mt-auto shrink-0" data-testid="sidebar-footer">
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

type SidebarCardProps = { title?: ReactNode; children: ReactNode };

/** Yon panel ichidagi to'q kulrang blok ("Kassa ilovasi" eslatmasi). */
export function SidebarCard({ title, children }: SidebarCardProps) {
  return (
    <div className="rounded-12 bg-ink-2 p-3.5 text-13 leading-[1.45] text-fog-1">
      {title ? <div className="mb-1 font-bold text-white">{title}</div> : null}
      {children}
    </div>
  );
}
