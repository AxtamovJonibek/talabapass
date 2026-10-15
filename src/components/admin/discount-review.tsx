"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DealBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icons";
import { useRouter } from "@/i18n/navigation";
import { approveDiscountAction, rejectDiscountAction, type ReviewResult } from "@/server/actions/admin-review";
import { DISCOUNT_REJECT_REASONS, type DiscountRejectReason } from "@/server/admin/review-rules";
import { CheckTable, DetailCard, type CheckRow } from "./review-parts";

export type DiscountReviewData = {
  discountId: string;
  code: string;
  title: string;
  meta: string;
  pending: boolean;
  stateLabel: string;
  preview: { icon: IconName; tileColor: string; inkColor: string; badge: string; business: string; price: string; images: string[] };
  rows: CheckRow[];
  nextHref: string;
};

/** Admin — chegirma tekshiruvi (dizaynda chizilmagan; A2 kartasi va jadvalidan): tasdiqlash / rad etish. */
export function DiscountReview(props: DiscountReviewData) {
  const t = useTranslations("admin.review");
  const router = useRouter();
  const [reason, setReason] = useState<DiscountRejectReason>(DISCOUNT_REJECT_REASONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ReviewResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setError(t("errors.not_pending"));
      router.push(props.nextHref);
    });
  }

  const p = props.preview;
  return (
    <DetailCard
      code={props.code}
      name={props.title}
      meta={props.meta}
      state={props.stateLabel}
      stateTone={props.pending ? "warn" : "ok"}
      left={
        <div className="flex flex-col gap-2">
          <span className="text-12 font-bold tracking-[0.05em] text-muted uppercase">{t("preview")}</span>
          <div className="flex items-center gap-3 rounded-16 bg-paper p-3">
            <div className="relative flex size-[92px] shrink-0 items-center justify-center rounded-12" style={{ background: p.tileColor, color: p.inkColor }}>
              {p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili (faqat admin/egasi)
                <img src={p.images[0]} alt="" className="absolute inset-0 size-full rounded-12 object-cover" />
              ) : (
                <Icon name={p.icon} size={46} strokeWidth={1.3} />
              )}
              <DealBadge className="absolute -top-[7px] -left-[5px]">{p.badge}</DealBadge>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-12 text-muted">{p.business}</span>
              <span className="text-16 leading-[1.2] font-bold">{props.title}</span>
              <span className="text-15 font-extrabold">{p.price}</span>
            </div>
          </div>
          {p.images.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {p.images.slice(1).map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block size-16 overflow-hidden rounded-12 bg-paper">
                  {/* eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili */}
                  <img src={src} alt="" className="size-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      }
      right={<CheckTable rows={props.rows} />}
      actions={
        <>
          <Button variant="green" size="md" className="px-[22px]" disabled={pending || !props.pending} onClick={() => run(() => approveDiscountAction({ discountId: props.discountId }))}>
            <Icon name="check" size={18} strokeWidth={3} />
            {t("approve")}
          </Button>
          <div className="flex flex-col gap-1">
            <label htmlFor="reject-reason-discount" className="text-12 text-muted">
              {t("rejectReason")}
            </label>
            <div className="flex gap-1.5">
              <Select id="reject-reason-discount" native compact value={reason} onChange={(e) => setReason(e.target.value as DiscountRejectReason)} disabled={!props.pending}>
                {DISCOUNT_REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.discount.${r}`)}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="md" disabled={pending || !props.pending} onClick={() => run(() => rejectDiscountAction({ discountId: props.discountId, reason }))}>
                {t("reject")}
              </Button>
            </div>
          </div>
          {error ? (
            <p role="alert" className="m-0 basis-full text-13 font-semibold text-danger">
              {error}
            </p>
          ) : null}
        </>
      }
      hint={t("hintDiscounts")}
    />
  );
}
