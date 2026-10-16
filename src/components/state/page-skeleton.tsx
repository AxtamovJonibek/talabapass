import { cn } from "@/lib/cn";

/** Yuklanish holati: sarlavha va bir necha karta o'rni (mavjud `surface` va `white` ranglari). Ekran tuzilmasini takrorlamaydi. */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div aria-busy="true" data-testid="page-skeleton" className={cn("mx-auto flex w-full max-w-[1360px] flex-col gap-3 px-5 pt-[58px] pb-5", className)}>
      {/* Bloklar navbat bilan "nafas oladi" (80ms siljish) — bir tekis miltillash o'rniga to'lqin */}
      {["h-8 w-2/5 rounded-10 bg-surface", "h-28 rounded-16 bg-white", "h-20 rounded-16 bg-white", "h-20 rounded-16 bg-white"].map((block, i) => (
        <div key={i} className={cn("skeleton-breathe", block)} style={{ animationDelay: `150ms, ${350 + i * 80}ms` }} />
      ))}
    </div>
  );
}
