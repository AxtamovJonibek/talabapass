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
  /** Uzunroq yozuv uchun kichikroq shrift: "Mag." (13px), hafta kunlari (14px) */
  textSize?: 13 | 14 | 15;
  /** Veb formadagi (WT1) qalinroq va kengroq variant: 700, kamida 56px, yon padding 14px */
  wide?: boolean;
  children: ReactNode;
};

/** Kvadrat tanlov tugmasi: kurs (T1), hafta kunlari (B2). */
const TOGGLE_TEXT = { 13: "text-13", 14: "text-14", 15: "text-15" } as const;

export function ToggleSquare({ selected = false, textSize = 15, wide = false, children, className, type = "button", ...props }: ToggleSquareProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "h-11 rounded-10 border-hair font-sans",
        wide ? "min-w-14 px-3.5 font-bold" : "font-semibold",
        TOGGLE_TEXT[textSize],
        selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
