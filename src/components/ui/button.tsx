import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";

const SIZES = {
  /** Asosiy CTA: T1 "Davom etish", B1 "Keyingi" */
  lg: "h-14 rounded-14 px-5 text-16",
  /** Admin harakatlari: A2 "Tasdiqlash" */
  md: "h-12 rounded-12 px-4 text-15",
  /** Ikkilamchi: B6 "Excel hisobot" */
  sm: "h-11 rounded-12 px-4 text-14",
} as const;

const VARIANTS = {
  blue: "border-0 bg-blue font-bold text-white",
  orange: "border-0 bg-orange font-extrabold text-ink",
  ink: "border-0 bg-ink font-bold text-white",
  green: "border-0 bg-green font-extrabold text-white",
  outline: "border-hair border-ink bg-white font-bold text-ink",
  "danger-outline": "border-hair border-danger-line bg-white font-bold text-danger",
  "danger-ghost": "border-0 bg-transparent font-bold text-danger",
  ghost: "border-0 bg-transparent font-semibold",
} as const;

export type ButtonStyle = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Matn chapda, ikonka o'ngda (CTA) — aks holda markazda */
  spread?: boolean;
  block?: boolean;
};

export function buttonClass(
  { variant = "blue", size = "lg", spread = false, block = false }: ButtonStyle,
  extra?: string,
) {
  return cn(
    "flex items-center gap-2 font-sans no-underline disabled:opacity-50",
    spread ? "justify-between" : "justify-center",
    block && "w-full",
    SIZES[size],
    VARIANTS[variant],
    extra,
  );
}

type ButtonProps = ButtonStyle & ComponentProps<"button">;

export function Button({ variant, size, spread, block, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, spread, block }, className)} {...props} />;
}

type ButtonLinkProps = ButtonStyle & ComponentProps<typeof Link>;

export function ButtonLink({ variant, size, spread, block, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, spread, block }, className)} {...props} />;
}
