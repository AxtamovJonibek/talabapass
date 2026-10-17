"use client";

import { cn } from "@/lib/cn";

type TogglePillProps = {
  id?: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  label: string;
  /** Sichqoncha ustida ko'rinadigan izoh */
  hint?: string;
  className?: string;
};

/** Yoqish-o'chirish tabletkasi (lentada "Hozir ochiq"): 44px, yoqilganda ko'k fon va oq matn. */
export function TogglePill({ id, pressed, onChange, label, hint, className }: TogglePillProps) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={pressed}
      title={hint}
      onClick={() => onChange(!pressed)}
      className={cn(
        "box-border flex h-11 shrink-0 items-center gap-2 rounded-22 border-hair px-4 font-sans text-14 font-bold whitespace-nowrap transition-[scale,background-color,color,border-color] duration-150 ease-out active:scale-[0.97]",
        pressed ? "border-blue bg-blue text-white" : "border-line bg-white text-ink hover:bg-surface",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", pressed ? "bg-white" : "bg-green-live")} />
      {label}
    </button>
  );
}
