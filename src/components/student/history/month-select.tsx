"use client";

import type { ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";

/** T7 "Oktabr 2026" tugmasi: ustida shaffof tizim `<select>` (telefonda o'z ro'yxati). Tanlansa — `?oy=YYYY-MM`. */
export function MonthSelect({ value, options, label, children }: { value: string; options: { value: string; label: string }[]; label: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <div className="relative">
      {children}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => router.push(`/tarix?oy=${e.target.value}`)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
