import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  /** dark — birinchi (asosiy) ko'rsatkich */
  tone?: "light" | "dark";
  valueClassName?: string;
};

/** KPI kartasi (B6, A1). */
export function StatCard({ label, value, note, tone = "light", valueClassName }: StatCardProps) {
  const dark = tone === "dark";
  return (
    <div className={cn("rounded-18 p-[18px]", dark ? "bg-ink text-paper" : "bg-white")}>
      <div className={cn("text-13", dark ? "text-fog-2" : "text-muted")}>{label}</div>
      <div className={cn("mt-2 text-44 leading-none font-black font-stretch-75%", valueClassName)}>{value}</div>
      {note ? <div className={cn("mt-2 text-12", dark ? "font-bold text-mint" : "text-muted")}>{note}</div> : null}
    </div>
  );
}
