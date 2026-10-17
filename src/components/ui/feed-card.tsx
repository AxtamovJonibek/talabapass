import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";

export type FeedCardProps = {
  href: string;
  /** "−30%", "1+1" */
  badge: string;
  store: string;
  /** "Chilonzor · 0.4 km" */
  where?: string;
  title: ReactNode;
  /** Narxli chegirma: yangi narx + (ixtiyoriy) eski narx */
  price?: { now: string; old?: string; currency: string };
  /** Narxsiz chegirma matni (narx o'rniga) */
  note?: ReactNode;
  /** "16 300 so'm tejaysiz" */
  saves?: string | null;
  /** Rasm ustidagi yorliq: "Tez tugaydi · 2/20" (hot) yoki "Ertaga 08:00" */
  tag?: { text: string; hot: boolean };
  /** "Hozir ochiq · 12/20" */
  status: string;
  /** Holat rangi: oz qoldi (rust) / ochiq (yashil) / keyinroq (kulrang) */
  statusTone: "hot" | "open" | "later";
  /** Chegirma rasmi; bo'lmasa — katta bosh harf va "Rasm kutilmoqda" */
  image?: string;
  pendingLabel: string;
  /** Kategoriya ranglari DB'dan keladi (Category.tileColor / inkColor) */
  tileColor: string;
  inkColor: string;
};

/** Foiz yorlig'i: "−30%", "1+1" (Lenta B · Jurnal) — yumaloq burchakli, −3° qiya. Joylashuvni ota element beradi. */
export function PctBadge({ children, size = "md", className }: { children: ReactNode; size?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("-rotate-3 rounded-11 bg-orange font-black whitespace-nowrap text-ink font-stretch-62%", size === "lg" ? "px-3 pt-2 pb-1.5 text-[64px] leading-[0.9]" : "px-2.5 pt-1.5 pb-1 text-[46px] leading-[0.9]", className)}>{children}</span>
  );
}

/** Rasm ustidagi mono yorliq: "Tez tugaydi · 2/20" (hot — qora fonda) yoki "Ertaga 08:00". */
export function DealTag({ hot, children, className }: { hot: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("px-2.5 py-1.5 font-mono text-11 font-semibold tracking-[0.08em] uppercase", hot ? "bg-ink text-orange" : "bg-white text-ink", className)}>{children}</span>
  );
}

const STATUS_TONES = {
  hot: "font-semibold text-rust",
  open: "text-green",
  later: "text-muted",
} as const;

/**
 * Lenta kartasi — "Lenta B · Jurnal": tepada 210px rasm (yorliq, foiz, narx plitkasi),
 * "chipta" tishlari va uzuq chiziqdan keyin biznes, nom va holat. Ota fon: paper.
 * T4 (telefon) va WT2 (panjara) uchun bir xil.
 */
export function FeedCard({ href, badge, store, where, title, price, note, saves, tag, status, statusTone, image, pendingLabel, tileColor, inkColor }: FeedCardProps) {
  const letter = store.trim().charAt(0).toUpperCase();
  return (
    <Link
      href={href}
      className="relative block rounded-4 border-0 text-ink no-underline outline-none shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue transition-[translate,scale,box-shadow] duration-[180ms] ease-out hover:-translate-y-1 hover:shadow-card-hover focus-visible:-translate-y-1 focus-visible:shadow-card-hover active:scale-[0.985] active:duration-100"
    >
      {/* Foiz yorlig'i kartadan sal chiqib turadi — shuning uchun kesuvchi qatlam ichida emas */}
      <PctBadge className="absolute -top-2.5 -right-2.5 z-[3]">{badge}</PctBadge>
      <div className="relative overflow-hidden rounded-4 bg-white">
        <span aria-hidden="true" className="absolute top-[199px] -left-[11px] z-[2] size-[22px] rounded-11 bg-paper" />
        <span aria-hidden="true" className="absolute top-[199px] -right-[11px] z-[2] size-[22px] rounded-11 bg-paper" />
        <div className="relative flex h-[210px] items-center justify-center overflow-hidden" style={{ background: tileColor }}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili (next/image optimizatori orqali emas)
            <img src={image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
          ) : (
            <>
              <span aria-hidden="true" className="absolute -top-10 -right-2.5 text-[260px] leading-none font-black opacity-[0.14] font-stretch-125%" style={{ color: inkColor }}>
                {letter}
              </span>
              <span className={cn("absolute left-3.5 font-mono text-10 tracking-[0.1em] uppercase", tag ? "top-11" : "top-3.5")} style={{ color: inkColor }}>
                {pendingLabel}
              </span>
            </>
          )}
          {tag ? (
            <DealTag hot={tag.hot} className="absolute top-0 left-0">
              {tag.text}
            </DealTag>
          ) : null}
          <div className="absolute bottom-0 left-0 flex max-w-full items-baseline gap-2 bg-white px-3.5 pt-2.5 pb-2">
            {price ? (
              <>
                <span className="text-32 leading-none font-black font-stretch-75%">{price.now}</span>
                <span className="text-13 font-bold">{price.currency}</span>
                {price.old ? <s className="font-mono text-12 text-muted-2">{price.old}</s> : null}
              </>
            ) : (
              <span className="text-18 leading-[1.1] font-black font-stretch-75%">{note}</span>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="border-t-hair-dashed mx-[18px] border-t-2" />
        <div className="flex flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
          <div className="flex items-center gap-2 font-mono text-11 tracking-[0.04em] text-muted">
            <span
              aria-hidden="true"
              className="flex size-[22px] shrink-0 items-center justify-center rounded-11 font-sans text-11 font-black"
              style={{ background: inkColor, color: tileColor }}
            >
              {letter}
            </span>
            <span className="min-w-0 truncate">
              <span className="font-semibold text-ink">{store}</span>
              {where ? <span className="uppercase"> · {where}</span> : null}
            </span>
          </div>
          <h2 className="m-0 text-22 leading-[1.05] font-extrabold tracking-[-0.02em] font-stretch-108%">{title}</h2>
          <div className="mt-1 flex items-center justify-between gap-2 text-12">
            <span className="font-bold text-green">{saves}</span>
            <span className={cn("ml-auto text-right font-mono", STATUS_TONES[statusTone])}>{status}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
