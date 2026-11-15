"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

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

const PASSWORD_BOX = {
  60: "h-15 rounded-18",
  64: "h-16 rounded-20",
} as const;

type PasswordBoxProps = {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  height?: keyof typeof PASSWORD_BOX;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Ko'z tugmasi yorliqlari; berilmasa tugma yo'q (o'ngda `trailing`) */
  toggleLabels?: { show: string; hide: string };
  trailing?: ReactNode;
};

/** Parol maydoni (Parol, Kirish): katta nuqtalar, ko'rsatish/yashirish tugmasi yoki o'ngda belgi. */
export function PasswordBox({ id, name, value, onChange, autoComplete, height = 60, invalid = false, autoFocus, toggleLabels, trailing }: PasswordBoxProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className={cn(
        "box-content flex items-center border-2 border-solid bg-white pl-[18px] focus-within:border-blue focus-within:shadow-focus-blue",
        PASSWORD_BOX[height],
        toggleLabels ? "pr-1.5" : "pr-[18px]",
        invalid ? "border-danger" : "border-ink",
      )}
    >
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-22 font-extrabold tracking-[0.08em] text-ink outline-none"
      />
      {toggleLabels ? (
        <button
          type="button"
          aria-label={visible ? toggleLabels.hide : toggleLabels.show}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="flex size-12 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-muted"
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={24} strokeWidth={2.2} />
        </button>
      ) : (
        trailing
      )}
    </div>
  );
}

const STRENGTH_BAR = { 1: "bg-danger", 2: "bg-orange", 3: "bg-green-bright", 4: "bg-green-bright" } as const;
const STRENGTH_TEXT = { 1: "text-danger", 2: "text-warn", 3: "text-green-ok", 4: "text-green-ok" } as const;

/** Parol kuchi: 4 bo'lak + yozuv ("Yaxshi"). */
export function StrengthBars({ score, label }: { score: 0 | 1 | 2 | 3 | 4; label: string | null }) {
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-live="polite">
      {[1, 2, 3, 4].map((n) => (
        <span key={n} aria-hidden="true" className={cn("h-1.5 flex-1 rounded-full", score > 0 && n <= score ? STRENGTH_BAR[score as 1] : "bg-line")} />
      ))}
      {score > 0 && label ? <span className={cn("ml-2 text-13 font-extrabold", STRENGTH_TEXT[score as 1])}>{label}</span> : null}
    </div>
  );
}
