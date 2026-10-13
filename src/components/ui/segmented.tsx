"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: ReactNode };

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** lg — W2 "Talaba / Biznes" (teng ustunlar); md — B6 davr tanlovi */
  size?: "md" | "lg";
  className?: string;
};

/** Kulrang "yo'lak" ichidagi oq faol bo'lakli almashtirgich. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "gap-1 bg-track p-1",
        size === "lg" ? "grid auto-cols-fr grid-flow-col rounded-14" : "flex rounded-12",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center justify-center gap-2 border-0 font-sans text-ink",
              size === "lg" ? "h-12 rounded-11 text-15 font-extrabold" : "h-9 rounded-9 px-3.5 text-14 font-bold",
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
