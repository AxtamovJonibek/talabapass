"use client";

import { cn } from "@/lib/cn";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
  /** 46×28 — B5 chegirma qatori */
  small?: boolean;
};

/** 50×30 almashtirgich (T8 bildirishnomalar, B5 chegirma faolligi). */
export function Switch({ checked, onChange, label, id, disabled, small = false }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative shrink-0 border-0 p-0 transition-[background-color,scale] duration-200 ease-tp", small ? "h-7 w-[46px] rounded-14" : "h-[30px] w-[50px] rounded-15", checked ? "bg-ink" : "bg-line")}
    >
      <span className={cn("absolute top-[3px] left-[3px] bg-white transition-[translate] duration-200 ease-tp", small ? "size-[22px] rounded-11" : "size-6 rounded-12", checked && (small ? "translate-x-[18px]" : "translate-x-[20px]"))} />
    </button>
  );
}
