import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  /** Yorliq yonidagi qo'shimcha: "52/120" */
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Yorliq + boshqaruv. T1, B1, WT1 formalaridagi qator. */
export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-13 font-semibold">
          {label}
        </label>
        {hint ? <span className="font-mono text-11 text-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="m-0 text-12 font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

const control =
  "box-border h-13 w-full min-w-0 rounded-12 border-hair bg-white px-3.5 font-sans text-15 text-ink outline-none focus:border-ink";

type InputProps = ComponentProps<"input"> & { invalid?: boolean };

export function Input({ className, invalid, ...props }: InputProps) {
  return <input className={cn(control, invalid ? "border-danger" : "border-line", className)} {...props} />;
}

type PhoneInputProps = Omit<ComponentProps<"input">, "type"> & { invalid?: boolean };

/** +998 prefiksli telefon maydoni (T1, W2). Qiymat — prefikssiz 9 raqam. */
export function PhoneInput({ className, invalid, ...props }: PhoneInputProps) {
  return (
    <div
      className={cn(
        "flex h-13 items-center gap-2.5 rounded-12 border-hair bg-white px-3.5",
        invalid ? "border-danger" : "border-ink",
        className,
      )}
    >
      <span className="font-mono text-15 text-muted">+998</span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className="min-w-0 flex-1 border-0 bg-transparent font-mono text-15 text-ink outline-none"
        {...props}
      />
    </div>
  );
}

type SelectProps = ComponentProps<"select"> & { invalid?: boolean };

export function Select({ className, invalid, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(control, "appearance-none pr-10", invalid ? "border-danger" : "border-line", className)}
        {...props}
      >
        {children}
      </select>
      <Icon name="chevronDown" size={18} className="pointer-events-none absolute top-[17px] right-3.5" />
    </div>
  );
}

type TextareaProps = ComponentProps<"textarea"> & { invalid?: boolean };

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "box-border w-full resize-none rounded-12 border-hair bg-white px-3.5 py-3 font-sans text-15 leading-[1.35] text-ink outline-none focus:border-ink",
        invalid ? "border-danger" : "border-line",
        className,
      )}
      {...props}
    />
  );
}
