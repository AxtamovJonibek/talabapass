"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { blockBusinessAction } from "@/server/actions/admin-review";
import { BUSINESS_REJECT_REASONS, type BusinessRejectReason } from "@/server/admin/review-rules";

/** Reytingdagi "Bloklash": tugma bosilsa sabab tanlanadi, so'ng tasdiq so'raladi (A2 dagi amal bilan bir xil). */
export function BlockBusiness({ businessId }: { businessId: string }) {
  const t = useTranslations("admin.review");
  const o = useTranslations("admin.overview.rating");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<BusinessRejectReason>(BUSINESS_REJECT_REASONS[0]);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function block() {
    if (!window.confirm(t("confirmBlockBusiness"))) return;
    setError(false);
    startTransition(async () => {
      const result = await blockBusinessAction({ businessId, reason });
      if (!result.ok) return setError(true);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="tp-lift h-8 rounded-8 border-hair border-danger-line bg-white px-2.5 font-sans text-13 font-semibold text-danger">
        {t("block")}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select native compact aria-label={t("rejectReason")} value={reason} onChange={(e) => setReason(e.target.value as BusinessRejectReason)}>
        {BUSINESS_REJECT_REASONS.map((r) => (
          <option key={r} value={r}>
            {t(`reasons.business.${r}`)}
          </option>
        ))}
      </Select>
      <button type="button" disabled={pending} aria-busy={pending} onClick={block} className="tp-lift h-8 rounded-8 border-hair border-danger-line bg-white px-2.5 font-sans text-13 font-semibold text-danger disabled:opacity-50">
        {t("block")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="tp-link h-8 rounded-8 border-0 bg-transparent px-1.5 font-sans text-13 font-semibold text-muted">
        {o("cancel")}
      </button>
      {error ? (
        <span role="alert" className="text-12 font-semibold text-danger">
          {o("blockFailed")}
        </span>
      ) : null}
    </span>
  );
}
