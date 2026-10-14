"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: ReactNode };

// [yo'lak, bo'lak]
const SIZES = {
  /** B6 davr tanlovi */
  md: ["flex rounded-12", "h-9 rounded-9 px-3.5 text-14 font-bold"],
  /** W2 "Talaba / Biznes" (teng ustunlar) */
  lg: ["grid auto-cols-fr grid-flow-col rounded-14", "h-12 rounded-11 text-15 font-extrabold"],
  /** B2 chegirma turi (teng ustunlar, 40px) */
  choice: ["grid auto-cols-fr grid-flow-col rounded-12", "h-10 rounded-9 text-14 font-bold"],
  /** WB2 chegirma turi (42px) */
  "choice-lg": ["grid auto-cols-fr grid-flow-col rounded-12", "h-[42px] rounded-9 text-14 font-bold"],
} as const;

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * Kulrang "yo'lak" ichidagi oq faol bo'lakli almashtirgich. `choice` o'lchamlari — forma qiymati (radio),
 * qolganlari — ko'rinishni almashtiradi (tab).
 */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md", className }: SegmentedProps<T>) {
  const radio = size === "choice" || size === "choice-lg";
  return (
    <div role={radio ? "radiogroup" : "tablist"} aria-label={label} className={cn("gap-1 bg-track p-1", SIZES[size][0], className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role={radio ? "radio" : "tab"}
            aria-selected={radio ? undefined : selected}
            aria-checked={radio ? selected : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center justify-center gap-2 border-0 font-sans text-ink",
              SIZES[size][1],
              selected ? "bg-white" : "bg-transparent",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
