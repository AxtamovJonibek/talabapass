import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type ChipProps = Omit<ComponentProps<"button">, "children"> & {
  selected?: boolean;
  /** Mono sanoq: kategoriyadagi chegirmalar soni */
  count?: ReactNode;
  children: ReactNode;
};

/** Filtr chipi (T4 kategoriyalar, B1 biznes turi, A3 auditoriya). */
export function Chip({ selected = false, count, children, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "flex h-[38px] shrink-0 items-center gap-1.5 rounded-19 border-hair px-3.5 font-sans text-14 font-semibold",
        selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
        className,
      )}
      {...props}
    >
      {children}
      {count != null ? <span className="font-mono text-11 opacity-70">{count}</span> : null}
    </button>
  );
}

type ToggleSquareProps = Omit<ComponentProps<"button">, "children"> & {
  selected?: boolean;
  children: ReactNode;
};

/** Kvadrat tanlov tugmasi: kurs (T1), hafta kunlari (B2). */
export function ToggleSquare({ selected = false, children, className, type = "button", ...props }: ToggleSquareProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "h-11 rounded-10 border-hair font-sans text-15 font-semibold",
        selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
