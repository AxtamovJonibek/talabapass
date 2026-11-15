"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * SMS kod kataklari (Kod ekrani): 6 ta 68px katak. Haqiqiy maydon bitta (SMS'dan avtomatik to'ldirish va
 * joylashtirish uchun) — kataklar ustida shaffof, bosilganda klaviatura ochiladi.
 */
export function CodeBoxes({ id, label, value, onChange, length = 6, invalid = false, disabled = false, autoFocus = false }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // So'rov tugab maydon qayta yoqilganda fokus qaytadi (brauzer o'chirilgan maydonda autoFocus'ni o'tkazib yuboradi)
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  const active = focused && !disabled ? Math.min(value.length, length - 1) : -1;

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-1 size-full cursor-text border-0 bg-transparent p-0 text-transparent caret-transparent opacity-0 outline-none"
      />
      <div aria-hidden="true" className="flex gap-2.5">
        {Array.from({ length }, (_, i) => {
          const digit = value[i];
          const current = i === active && !digit;
          return (
            <span
              key={i}
              className={cn(
                "box-content flex h-[68px] min-w-0 flex-1 items-center justify-center rounded-18 border-2 border-solid bg-white text-30 font-black tabular-nums",
                invalid ? "border-danger" : current || (i === active && digit) ? "border-blue shadow-focus-blue" : digit ? "border-ink" : "border-line",
              )}
            >
              {digit ?? (current ? <span className="h-[30px] w-0.5 animate-pulse bg-blue" /> : null)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
