"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Har bir katak uchun yorliq: (1) → "1-raqam" */
  digitLabel: (position: number) => string;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** SMS kod kataklari (W2). Yozish, o'chirish va joylashtirish (paste) qo'llab-quvvatlanadi. */
export function OtpInput({ value, onChange, digitLabel, length = 6, invalid, disabled, autoFocus }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (index: number) => refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  // Kataklar o'chirilgan holatda (so'rov ketayotganda) chizilsa brauzer autoFocus'ni o'tkazib yuboradi.
  useEffect(() => {
    if (autoFocus && !disabled) refs.current[Math.min(value.length, length - 1)]?.focus();
    // faqat yoqilganda/qayta yoqilganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled]);

  function write(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(0, length);
    onChange(next);
    focus(index + digits.length);
  }

  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid || undefined}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => write(i, e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            write(i, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              const at = value[i] ? i : i - 1;
              if (at >= 0) onChange(value.slice(0, at));
              focus(at);
            } else if (e.key === "ArrowLeft") focus(i - 1);
            else if (e.key === "ArrowRight") focus(i + 1);
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            "box-border h-[60px] min-w-0 rounded-12 bg-white p-0 text-center font-mono text-24 font-semibold text-ink outline-none",
            "focus:border-2 focus:border-blue",
            invalid ? "border-hair border-danger" : value[i] ? "border-hair border-ink" : "border-hair border-line",
          )}
        />
      ))}
    </div>
  );
}
