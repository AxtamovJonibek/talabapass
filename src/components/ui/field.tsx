import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  /** Yorliq yonidagi qo'shimcha: "52/120" */
  hint?: ReactNode;
  /** B1/WB1 tavsif sanog'i: yorliq o'lchamida (13px), oddiy og'irlikda */
  counter?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Yorliq + boshqaruv. T1, B1, WT1 formalaridagi qator. */
export function Field({ label, htmlFor, hint, counter, error, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-13 font-semibold">
          {label}
        </label>
        {hint ? <span className="font-mono text-11 text-muted">{hint}</span> : null}
        {counter != null ? <span className="font-mono text-13 text-muted">{counter}</span> : null}
      </div>
      {children}
      {error ? <p className="m-0 text-12 font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

const shell = "box-border w-full min-w-0 rounded-12 border-hair bg-white px-3.5 text-ink outline-none focus:border-ink";
const control = `${shell} h-13 font-sans text-15`;

const MONO = { 14: "font-mono text-14", 15: "font-mono text-15" } as const;

type InputProps = ComponentProps<"input"> & {
  invalid?: boolean;
  /** 50px balandlik — B1 telefon formasi */
  dense?: boolean;
  /** Raqamli qiymatlar (STIR, ish vaqti, telefon) uchun mono shrift */
  mono?: keyof typeof MONO;
};

export function Input({ className, invalid, dense = false, mono, ...props }: InputProps) {
  return (
    <input
      className={cn(shell, dense ? "h-12.5" : "h-13", mono ? MONO[mono] : "font-sans text-15", invalid ? "border-danger" : "border-line", className)}
      {...props}
    />
  );
}

type IconInputProps = Omit<ComponentProps<"input">, "size"> & { invalid?: boolean; icon: ReactNode };

/** Oxirida ikonkasi bor maydon (B1 manzil — xarita belgisi). 50px. */
export function IconInput({ className, invalid, icon, ...props }: IconInputProps) {
  return (
    <div
      className={cn(
        "box-border flex h-12.5 items-center gap-2.5 rounded-12 border-hair bg-white pr-3 pl-3.5 focus-within:border-ink",
        invalid ? "border-danger" : "border-line",
        className,
      )}
    >
      <input className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-15 text-ink outline-none" {...props} />
      {icon}
    </div>
  );
}

const PHONE_SIZES = {
  // Dizayndagidek content-box: balandlik chegarasiz hisoblanadi (T1: 52, W2: 56)
  md: { box: "box-content h-13 rounded-12 bg-white px-3.5", text: "text-15", prefix: "text-15" },
  lg: { box: "box-content h-14 rounded-14 bg-white px-4", text: "text-16", prefix: "text-16" },
  // WT1: fon yo'q, "+998" 16px, raqam 15px
  web: { box: "box-content h-13 rounded-12 px-3.5", text: "text-15", prefix: "text-16" },
} as const;

type PhoneInputProps = Omit<ComponentProps<"input">, "type" | "size"> & {
  invalid?: boolean;
  size?: keyof typeof PHONE_SIZES;
  /** Kulrang chegara (asosiy maydon emas): WB1 2-qadam "Telefon" */
  quiet?: boolean;
};

/** +998 prefiksli telefon maydoni (T1, W2). Qiymat — prefikssiz 9 raqam. */
export function PhoneInput({ className, invalid, size = "md", quiet = false, ...props }: PhoneInputProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-hair",
        PHONE_SIZES[size].box,
        invalid ? "border-danger" : quiet ? "border-line bg-white focus-within:border-ink" : "border-ink",
        className,
      )}
    >
      <span className={cn("font-mono text-muted", PHONE_SIZES[size].prefix)}>+998</span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className={cn("min-w-0 flex-1 border-0 bg-transparent px-0.5 py-px font-mono text-ink outline-none", PHONE_SIZES[size].text)}
        {...props}
      />
    </div>
  );
}

type SelectProps = ComponentProps<"select"> & {
  invalid?: boolean;
  /** Brauzerning o'z ko'rinishi (strelkasi) bilan — WT1 veb formasi */
  native?: boolean;
  /** Pastroq va kichikroq yozuvli (48px, 14px) — A2 rad etish sababi */
  compact?: boolean;
};

export function Select({ className, invalid, native = false, compact = false, children, ...props }: SelectProps) {
  if (native) {
    return (
      <select
        className={cn(
          "min-w-0 rounded-12 border-hair bg-white px-3 font-sans text-ink outline-none focus:border-ink",
          compact ? "h-12 text-14" : "h-13 w-full text-15",
          invalid ? "border-danger" : "border-line",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
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

type TextareaProps = ComponentProps<"textarea"> & {
  invalid?: boolean;
  /** Veb formasi (WB1): balandligini o'zgartirsa bo'ladi, qatorlar oralig'i 1.4 */
  resizable?: boolean;
};

export function Textarea({ className, invalid, resizable = false, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "box-border w-full rounded-12 border-hair bg-white px-3.5 py-3 font-sans text-15 text-ink outline-none focus:border-ink",
        resizable ? "resize-y leading-[1.4]" : "resize-none leading-[1.35]",
        invalid ? "border-danger" : "border-line",
        className,
      )}
      {...props}
    />
  );
}
