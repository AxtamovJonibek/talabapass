"use client";

import { cn } from "@/lib/cn";

export type ViewOption<V extends string> = { value: V; label: string };

type ViewSwitchProps<V extends string> = {
  /** Ekran o'qigichlar uchun nom ("Ko'rinish") */
  label: string;
  value: V;
  options: ViewOption<V>[];
  onChange: (value: V) => void;
  className?: string;
};

/** Ikki bo'lakli ko'rinish tanlovi ("Ro'yxat | Xarita"): 44px, tanlangani ko'k fonda. */
export function ViewSwitch<V extends string>({ label, value, options, onChange, className }: ViewSwitchProps<V>) {
  return (
    <div role="group" aria-label={label} className={cn("box-border flex h-11 shrink-0 items-center gap-0.5 rounded-22 border-hair border-line bg-white p-[3px]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-19 border-0 px-3.5 font-sans text-14 font-bold whitespace-nowrap transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.97]",
            o.value === value ? "bg-blue text-white" : "bg-transparent text-ink hover:bg-surface",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
