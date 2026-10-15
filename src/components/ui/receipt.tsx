import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const RECEIPT_VARIANTS = {
  /** T7: talaba tarixidagi chek */
  card: { paper: "rounded-t-16 px-4 pt-3.5 pb-4", rows: "gap-1.5 text-13", header: "mt-3" },
  /** B4: kassada chiqarilgan chek (chop etish ko'rinishi) */
  print: { paper: "rounded-t-4 px-[18px] pt-[18px] pb-[22px]", rows: "gap-[7px] text-13", header: "mt-0" },
  /** WT4: veb tarixdagi katta chek */
  web: { paper: "rounded-t-22 p-[22px]", rows: "gap-2 text-14", header: "mt-0" },
} as const;

type ReceiptProps = { header?: ReactNode; children: ReactNode; variant?: keyof typeof RECEIPT_VARIANTS; className?: string };

/** Chek qog'ozi: oq blok + pastki arra chet (T7, B4, WT4). */
export function Receipt({ header, children, variant = "card", className }: ReceiptProps) {
  const v = RECEIPT_VARIANTS[variant];
  return (
    <div className={className}>
      <div className={cn("bg-white", v.paper)}>
        {header}
        <div className={cn("flex flex-col font-mono", v.rows, header ? v.header : null)}>{children}</div>
      </div>
      <div aria-hidden="true" className={variant === "web" ? "receipt-edge-lg" : "receipt-edge"} />
    </div>
  );
}

type ReceiptRowProps = {
  label: ReactNode;
  value: ReactNode;
  /** discount — to'q sariq-jigarrang; total — yirik yakuniy qator */
  kind?: "default" | "discount" | "total" | "grand" | "plain";
};

export function ReceiptRow({ label, value, kind = "default" }: ReceiptRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        kind === "discount" && "text-rust",
        kind === "total" && "mt-0.5 text-16 font-semibold",
        // B4 / WT4: "JAMI" / "To'landi" — 18px
        kind === "grand" && "mt-1 text-18 font-semibold",
      )}
    >
      <span className={kind === "default" ? "text-muted" : undefined}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ReceiptDivider({ wide = false }: { wide?: boolean }) {
  return <div className={cn("border-t-hair-dashed", wide ? "my-1.5" : "my-1")} />;
}
