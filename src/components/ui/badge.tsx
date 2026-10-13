import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type DealBadgeProps = { children: ReactNode; className?: string };

/** Kartadagi qiya to'q sariq yorliq: "−30%", "1+1". Joylashuvni ota element beradi. */
export function DealBadge({ children, className }: DealBadgeProps) {
  return (
    <div
      className={cn(
        "-rotate-6 rounded-6 bg-orange px-[7px] py-1 text-17 leading-none font-black whitespace-nowrap text-ink font-stretch-70%",
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
