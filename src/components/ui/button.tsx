import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";

const SIZES = {
  /** Asosiy CTA: T1 "Davom etish", B1 "Keyingi" */
  lg: "h-14 rounded-14 px-5 text-16",
  /** Veb formalar pastidagi tugmalar: WT1 "Davom etish", "Orqaga" */
  wide: "h-13 rounded-14 px-6 text-16",
  /** Shu qatordagi ikkilamchi tugma: WT1 "Orqaga" (torroq, 15px) */
  "wide-quiet": "h-13 rounded-14 px-[18px] text-15",
  /** WB1 pastidagi tugmalar (54px): "Keyingi: hujjatlar" */
  tall: "h-13.5 rounded-14 px-6 text-16",
  /** O'sha qatordagi ikkilamchi: WB1 "Orqaga" */
  "tall-quiet": "h-13.5 rounded-14 px-[18px] text-15",
  /** WB1 3-qadam "Kabinetga o'tish" */
  "tall-link": "h-13.5 rounded-14 px-[22px] text-15",
  /** Karta ichidagi CTA (50px): WB1 "Chegirma yaratish" */
  card: "h-12.5 rounded-14 px-[18px] text-15",
  /** T5 pastki CTA (58px): "Chegirmani olish" */
  cta: "h-[58px] rounded-16 px-5 text-17",
  /** WT3 yon panelidagi CTA (60px) */
  "cta-lg": "h-15 rounded-16 px-5 text-18",
  /** Admin harakatlari: A2 "Tasdiqlash" */
  md: "h-12 rounded-12 px-4 text-15",
  /** WB2 sarlavhasidagi asosiy tugma: "E'lon qilish" */
  "md-wide": "h-12 rounded-12 px-[22px] text-15",
  /** 404 / oflayn ekranlari (56px, radius 16, 17px) */
  state: "h-14 rounded-16 px-6 text-17",
  /** Ikkilamchi: B6 "Excel hisobot" */
  sm: "h-11 rounded-12 px-4 text-14",
} as const;

// [ko'rinish, standart yozuv og'irligi]; harakat sinflari (tp-*) — globals.css, design/Tugmalar
const VARIANTS = {
  blue: ["tp-stamp border-0 bg-blue text-white", "font-bold"],
  orange: ["tp-stamp border-0 bg-orange text-ink [--tp-bar:var(--color-ink)]", "font-extrabold"],
  ink: ["tp-stamp border-0 bg-ink text-white [--tp-shadow:var(--color-orange)]", "font-bold"],
  green: ["tp-stamp border-0 bg-green text-white", "font-extrabold"],
  outline: ["tp-paint border-hair border-ink bg-white text-ink", "font-bold"],
  /** Shaffof fonli, qora chegarali: 404 / oflayn ikkilamchi tugmasi */
  "outline-clear": ["tp-paint border-hair border-ink bg-transparent text-ink", "font-bold"],
  /** Ikkilamchi, kulrang chegarali: WT1 "Orqaga" */
  "outline-soft": ["tp-paint border-hair border-line bg-white text-ink", "font-bold"],
  /** O'sha tugmaning faol bo'lmagan ko'rinishi: WT1 birinchi qadamdagi "Orqaga" */
  "outline-idle": ["border-hair border-line bg-white text-fog-3", "font-bold"],
  "danger-outline": ["border-hair border-danger-line bg-white text-danger hover:bg-danger-bg", "font-bold"],
  "danger-ghost": ["border-0 bg-transparent text-danger hover:bg-danger-bg", "font-bold"],
  ghost: ["border-0 bg-transparent hover:bg-surface", "font-semibold"],
  /** Hozir bosib bo'lmaydigan asosiy harakat (chegirma hali ochilmagan): o'qiladigan kulrang, xira ko'k emas */
  idle: ["border-0 bg-track text-muted", "font-bold"],
} as const;

export type ButtonStyle = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Matn chapda, ikonka o'ngda (CTA) — aks holda markazda */
  spread?: boolean;
  block?: boolean;
  /** Og'irroq yozuv (800): W2 "SMS kod olish", "Kirish" */
  strong?: boolean;
};

export function buttonClass(
  { variant = "blue", size = "lg", spread = false, block = false, strong = false }: ButtonStyle,
  extra?: string,
) {
  const [look, weight] = VARIANTS[variant];
  // idle o'zi "nofaol" ko'rinishda — ustiga yana xiralashtirilmaydi
  const idle = variant === "idle";
  return cn(
    // Bosilganda 0.97 ga kichrayadi (120ms) — interfeys "eshitdi" degan javob; stamp/paint/squish — o'zining bosilish harakati
    "tp-btn flex items-center gap-2 font-sans no-underline disabled:scale-100 disabled:hover:brightness-100",
    // stamp o'z o'tishini (translate, box-shadow) globals.css da beradi
    !look.includes("tp-stamp") && "transition-[scale,opacity,background-color,filter] duration-120 ease-out",
    !look.includes("tp-") && "active:scale-[0.97]",
    !idle && "disabled:opacity-50",
    spread ? "justify-between" : "justify-center",
    block && "w-full",
    SIZES[size],
    look,
    strong ? "font-extrabold" : weight,
    extra,
  );
}

type ButtonProps = ButtonStyle &
  ComponentProps<"button"> & {
    /** Kutish: tugma bosilmaydi, pastida to'q sariq chiziq yuguradi (`aria-busy`) */
    loading?: boolean;
  };

export function Button({ variant, size, spread, block, strong, loading, disabled, className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, spread, block, strong }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    />
  );
}

type ButtonLinkProps = ButtonStyle & ComponentProps<typeof Link>;

export function ButtonLink({ variant, size, spread, block, strong, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, spread, block, strong }, className)} {...props} />;
}
