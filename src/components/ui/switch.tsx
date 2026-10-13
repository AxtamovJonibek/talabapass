"use client";

import { cn } from "@/lib/cn";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
};

/** 50×30 almashtirgich (T8 bildirishnomalar, B5 chegirma faolligi). */
export function Switch({ checked, onChange, label, id, disabled }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[30px] w-[50px] shrink-0 rounded-15 border-0 p-0", checked ? "bg-ink" : "bg-line")}
    >
      <span className={cn("absolute top-[3px] size-6 rounded-12 bg-white", checked ? "right-[3px]" : "left-[3px]")} />
    </button>
  );
}
