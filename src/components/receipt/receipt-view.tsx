import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Receipt, ReceiptDivider, ReceiptRow } from "@/components/ui/receipt";
import { formatSom, MINUS } from "@/lib/format";
import type { ReceiptData } from "@/server/coupons/receipts";

const tin = (value: string) => value.replace(/(\d{3})(?=\d)/g, "$1 ");

/** B4 "Chek chiqarildi": kassadagi chek (biznes nomi markazda, kassir va talaba bilan). */
export function PrintReceipt({ r }: { r: ReceiptData }) {
  const t = useTranslations("receipt");
  const pay = useTranslations("paymentType");
  return (
    <Receipt
      variant="print"
      header={
        <div className="flex flex-col gap-[7px] font-mono text-13">
          <div className="text-center font-semibold">{r.business.name.toUpperCase()}</div>
          <div className="text-center text-12 text-muted">{[r.business.address, r.business.tin ? `STIR ${tin(r.business.tin)}` : null].filter(Boolean).join(" · ")}</div>
          <ReceiptDivider wide />
        </div>
      }
    >
      <ReceiptRow kind="plain" label={t("no")} value={r.no} />
      <ReceiptRow kind="plain" label={t("date")} value={r.time} />
      <ReceiptRow kind="plain" label={t("student")} value={r.student} />
      <ReceiptRow kind="plain" label={t("cashier")} value={r.cashier} />
      <ReceiptDivider wide />
      <ReceiptRow kind="plain" label={r.item} value={formatSom(r.originalPrice)} />
      <ReceiptRow kind="plain" label={`talabaPass ${r.badge}`} value={`${MINUS}${formatSom(r.discountAmount)}`} />
      <ReceiptRow kind="grand" label={t("total")} value={formatSom(r.paidAmount)} />
      <ReceiptRow label={t("payment")} value={pay(r.paymentType)} />
    </Receipt>
  );
}

/** T7 / WT4: talaba tarixidagi chek ("Sotuv tasdiqlandi", CHEK №). */
export function HistoryReceipt({ r, web = false }: { r: ReceiptData; web?: boolean }) {
  const t = useTranslations("receipt");
  const common = useTranslations("common");
  const status = (
    <span className="flex items-center gap-1.5 font-sans text-12 font-bold text-green">
      {web ? null : <Icon name="check" size={14} strokeWidth={3} />}
      {t("confirmed")}
    </span>
  );
  return (
    <Receipt
      variant={web ? "web" : "card"}
      header={
        <div className={web ? "flex flex-col gap-2" : undefined}>
          <div className="flex items-center justify-between">
            {status}
            <span className="font-mono text-12 text-muted">{t("number", { no: r.no })}</span>
          </div>
          {web ? (
            <>
              <div className="mt-1.5 text-22 font-black">{r.business.name}</div>
              <ReceiptDivider wide />
            </>
          ) : null}
        </div>
      }
    >
      {web ? null : <ReceiptRow label={t("business")} value={r.business.name} />}
      <ReceiptRow label={t("product")} value={r.item} />
      <ReceiptRow label={t("time")} value={r.time} />
      <ReceiptRow label={t("cashier")} value={r.cashier} />
      <ReceiptDivider wide={web} />
      <ReceiptRow label={t("originalPrice")} value={formatSom(r.originalPrice)} />
      <ReceiptRow kind="discount" label={web ? t("discountPlain") : t("discount", { badge: r.badge })} value={`${MINUS}${formatSom(r.discountAmount)}`} />
      <ReceiptRow kind={web ? "grand" : "total"} label={t("paid")} value={`${formatSom(r.paidAmount)} ${common("currency")}`} />
    </Receipt>
  );
}
