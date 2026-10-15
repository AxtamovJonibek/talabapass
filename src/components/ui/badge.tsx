import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const DEAL_BADGE_SIZES = {
  /** T4 kartasi (92px rasm ustida) */
  md: "-rotate-6 rounded-6 px-[7px] py-1 text-17 leading-none font-stretch-70%",
  /** WT2 / WT3 kartasi (150px rasm ustida) */
  lg: "-rotate-5 rounded-8 px-2 pt-[5px] pb-[3px] text-24 leading-none font-stretch-65%",
  /** T5 rasm ustidagi katta yorliq */
  xl: "-rotate-5 rounded-10 px-3 pt-2 pb-1.5 text-[54px] leading-[0.9] font-stretch-62%",
  /** WT3 rasm ustidagi katta yorliq */
  "2xl": "-rotate-5 rounded-12 px-3.5 pt-2 pb-1.5 text-64 leading-[0.9] font-stretch-62%",
  /** WT3 "Yaqin atrofda", xarita belgisi */
  sm: "min-w-12 rounded-5 px-1.5 py-[3px] text-center text-14 font-stretch-70%",
} as const;

type DealBadgeProps = { children: ReactNode; size?: keyof typeof DEAL_BADGE_SIZES; /** Hozir yopiq: kulrang */ muted?: boolean; className?: string };

/** Kartadagi qiya to'q sariq yorliq: "−30%", "1+1". Joylashuvni ota element beradi. */
export function DealBadge({ children, size = "md", muted = false, className }: DealBadgeProps) {
  return (
    <div
      className={cn(
        "font-black whitespace-nowrap text-ink",
        DEAL_BADGE_SIZES[size],
        muted ? "bg-track" : "bg-orange",
        className,
      )}
    >
      {children}
    </div>
  );
}

const TONES = {
  ok: "bg-green-bg text-green",
  warn: "bg-warn-bg text-warn",
  bad: "bg-danger-bg text-danger",
  info: "bg-info-bg text-blue",
} as const;

type StatusPillProps = {
  tone: keyof typeof TONES;
  /** lg — A2 ariza holati; sm — jadval qatorlari */
  size?: "sm" | "lg";
  children: ReactNode;
};

export function StatusPill({ tone, size = "sm", children }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap",
        size === "lg" ? "rounded-20 px-3 py-1.5 text-13 font-extrabold" : "rounded-10 px-2 py-[3px] text-12 font-bold",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Chegirma holati nuqtasi: yashil — hozir ochiq, kulrang — keyinroq. */
export function LiveDot({ live }: { live: boolean }) {
  return <span className={cn("size-[7px] shrink-0 rounded-4", live ? "bg-green-live" : "bg-fog-3")} />;
}
