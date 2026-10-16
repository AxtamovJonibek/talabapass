import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

const VARIANTS = {
  /** Telefon sarlavhasi: 44px doira (T5, B2 dagidek) */
  round: "size-11 rounded-full",
  /** Veb va ichki sahifalar: "← Orqaga" matni */
  text: "h-11 gap-1.5 text-14 font-bold",
} as const;

const TONES = {
  light: "bg-white text-ink",
  /** Fonsiz (paper yoki oq karta ustida) */
  plain: "bg-transparent text-ink",
  /** Qora ekran (kamera, skaner) */
  dark: "bg-ink-2 text-paper",
} as const;

type Look = { variant?: keyof typeof VARIANTS; tone?: keyof typeof TONES; className?: string };

const face = ({ variant = "round", tone = "light", className }: Look) =>
  cn("flex shrink-0 items-center justify-center border-0 font-sans no-underline", VARIANTS[variant], variant === "text" && tone === "light" ? TONES.plain : TONES[tone], className);

function Content({ variant = "round", label }: { variant?: keyof typeof VARIANTS; label: string }) {
  return variant === "text" ? (
    <>
      <Icon name="arrowLeft" size={18} strokeWidth={2.2} />
      {label}
    </>
  ) : (
    <>
      <Icon name="chevronLeft" size={20} />
      <span className="sr-only">{label}</span>
    </>
  );
}

/** "Orqaga" havolasi: sahifa tuzilmasidagi ota sahifaga (yoki bosh sahifaga). */
export function BackLink({ href, label, ...look }: Look & { href: ComponentProps<typeof Link>["href"]; label?: string }) {
  const t = useTranslations("common");
  return (
    <Link href={href} className={face(look)}>
      <Content variant={look.variant} label={label ?? t("back")} />
    </Link>
  );
}

/** "Orqaga" tugmasi: ko'p qadamli formada oldingi qadamga (yoki 1-qadamda — chiqishga). */
export function BackButton({ onClick, label, disabled, ...look }: Look & { onClick: () => void; label?: string; disabled?: boolean }) {
  const t = useTranslations("common");
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={face(look)}>
      <Content variant={look.variant} label={label ?? t("back")} />
    </button>
  );
}
