import { cn } from "@/lib/cn";
import { SITE_NAME } from "@/lib/seo";

// Brend logotipi (design/brand, `scripts/brand-assets.mjs` → public/brand/wordmark*.svg — chetidagi bo'sh joysiz nusxa).
// Balandlik = "Pass" plashkasi balandligi. Kalitlar eski matnli logotip o'lchamlari: 14 — T8 karta, 17 — sidebar/B1,
// 18 — T1, 20 — W1 header, 22 — W1 footer, state-* — 404 / oflayn ekranlari, app* — ilova oqimi (AppLogo).
const HEIGHTS = { 14: 18, 17: 21, 18: 22, 20: 25, 22: 28, "state-phone": 30, "state-web": 40, app: 27, "app-lg": 31 } as const;
/** viewBox 1346.2 × 216.27 */
const RATIO = 1346.2 / 216.27;

const TAGS = {
  orange: "bg-orange text-ink",
  paper: "bg-paper text-ink",
} as const;

// "BIZNES" yorlig'i: sm — sidebar/WB1 (11px), md — B1 telefon sarlavhasi (12px, kengroq)
const TAG_SIZES = {
  sm: "px-1.5 text-11",
  md: "px-[7px] text-12 tracking-[0.04em]",
} as const;

type LogoProps = {
  size?: keyof typeof HEIGHTS;
  /** `white` — ko'k yoki qorong'i fonda (brend qoidasi: qorong'i fonda faqat oq variant) */
  variant?: "color" | "white";
  /** "BIZNES" / "ADMIN" yorlig'i */
  tag?: string;
  tagTone?: keyof typeof TAGS;
  tagSize?: keyof typeof TAG_SIZES;
  className?: string;
};

/** "talaba[Pass]" brend belgisi (rasm, alt — "Talaba Pass"). */
export function Logo({ size = 18, variant = "color", tag, tagTone = "orange", tagSize = "sm", className }: LogoProps) {
  const height = HEIGHTS[size];
  const width = Math.round(height * RATIO);
  return (
    // Joylashuv va o'lcham inline: marketing sahifalarining `dz` doirasi (`all: revert`) klasslarni ham, img width/height
    // atributlarini ham bekor qiladi — inline style undan ustun. Joy yetmasa (360px sarlavha) proporsional kichrayadi.
    <div className={className} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG: optimallashtirish kerak emas, o'lcham aniq berilgan */}
      <img
        src={variant === "white" ? "/brand/wordmark-white.svg" : "/brand/wordmark.svg"}
        alt={SITE_NAME}
        width={width}
        height={height}
        style={{ display: "block", width, maxWidth: "100%", height: "auto", aspectRatio: `${width} / ${height}` }}
      />
      {tag ? (
        <span className={cn("rounded-5 py-[3px] font-bold font-stretch-100%", TAG_SIZES[tagSize], TAGS[tagTone])}>
          {tag}
        </span>
      ) : null}
    </div>
  );
}
