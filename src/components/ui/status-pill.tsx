import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const DOTS = {
  /** Hozir ochiq — yashil, sekin "nafas oladi" */
  open: "bg-green-live live-dot",
  /** Tez orada / bugun keyinroq */
  soon: "bg-orange",
  /** Yopiq */
  closed: "bg-placeholder",
} as const;

export type StatusTone = keyof typeof DOTS;

/**
 * Holat pilyulkasi: "Hozir ochiq · 23:00 gacha", "45 daqiqadan keyin ochiladi", "Yopiq · ertaga 09:00 da".
 * To'liq yumaloq, 13px, oddiy harflar; chapda 8px nuqta. `onImage` — rasm ustida (yarim shaffof oq, xira fon, ichki
 * chiziq, juda yengil soya), aks holda och fon. Lenta kartasi, chegirma sahifasi va xarita bir xil ko'rinishda.
 */
export function StatusPill({ tone, onImage = false, children, className }: { tone: StatusTone; onImage?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-13 leading-none font-semibold whitespace-nowrap text-ink",
        onImage ? "bg-white/80 shadow-pill ring-1 ring-ink/10 ring-inset backdrop-blur-md" : "bg-surface",
        className,
      )}
      data-testid="status-pill"
      data-tone={tone}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", DOTS[tone])} />
      <span className="truncate">{children}</span>
    </span>
  );
}
