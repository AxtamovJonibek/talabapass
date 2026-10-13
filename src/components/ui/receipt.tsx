import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ReceiptProps = { header?: ReactNode; children: ReactNode; className?: string };

/** Chek qog'ozi: oq blok + pastki arra chet (T7, B4, WT4). */
export function Receipt({ header, children, className }: ReceiptProps) {
  return (
    <div className={className}>
      <div className="rounded-t-16 bg-white px-4 pt-3.5 pb-4">
        {header}
        <div className={cn("flex flex-col gap-1.5 font-mono text-13", header ? "mt-3" : null)}>{children}</div>
      </div>
      <div aria-hidden="true" className="receipt-edge" />
    </div>
  );
}

type ReceiptRowProps = {
  label: ReactNode;
  value: ReactNode;
  /** discount — to'q sariq-jigarrang; total — yirik yakuniy qator */
  kind?: "default" | "discount" | "total";
};

export function ReceiptRow({ label, value, kind = "default" }: ReceiptRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        kind === "discount" && "text-rust",
        kind === "total" && "mt-0.5 text-16 font-semibold",
      )}
    >
      <span className={kind === "default" ? "text-muted" : undefined}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ReceiptDivider() {
  return <div className="border-t-hair-dashed my-1" />;
}
