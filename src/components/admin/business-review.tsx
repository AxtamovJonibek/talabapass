"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";
import { approveBusinessAction, blockBusinessAction, rejectBusinessAction, type ReviewResult } from "@/server/actions/admin-review";
import { BUSINESS_REJECT_REASONS, type BusinessRejectReason } from "@/server/admin/review-rules";
import { CheckTable, DetailCard, type CheckRow } from "./review-parts";

export type BusinessReviewData = {
  businessId: string;
  code: string;
  name: string;
  meta: string;
  photoUrl?: string | null;
  initials?: string;
  state: "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED" | "WARNED";
  /** Joy fotolari (3 tagacha) — himoyalangan manzillar */
  photos: string[];
  docs: { id: string; name: string; url: string }[];
  rows: CheckRow[];
  nextHref: string;
};

const PHOTO_SLOTS = [1, 2, 3] as const;

/** A2 (biznes) — joy fotolari, hujjatlar, STIR va aloqa ma'lumotlari; tasdiqlash / rad etish / bloklash. */
export function BusinessReview(props: BusinessReviewData) {
  const t = useTranslations("admin.review");
  const router = useRouter();
  const [reason, setReason] = useState<BusinessRejectReason>(BUSINESS_REJECT_REASONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const decided = props.state !== "PENDING";

  function run(action: () => Promise<ReviewResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setError(t("errors.not_pending"));
      router.push(props.nextHref);
      router.refresh();
    });
  }

  return (
    <DetailCard
      code={props.code}
      name={props.name}
      meta={props.meta}
      photoUrl={props.photoUrl}
      initials={props.initials}
      state={t(`state.${props.state === "WARNED" ? "APPROVED" : props.state}`)}
      stateTone={props.state === "PENDING" ? "warn" : props.state === "APPROVED" || props.state === "WARNED" ? "ok" : "bad"}
      left={
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {PHOTO_SLOTS.map((slot, i) => {
              const url = props.photos[i];
              return url ? (
                <a key={slot} href={`${url}?maqsad=full`} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-10 bg-track">
                  {/* eslint-disable-next-line @next/next/no-img-element -- himoyalangan, keshlanmaydigan manzil */}
                  <img src={url} alt={t(`photos.${slot}`)} className="size-full object-cover" />
                </a>
              ) : (
                <div key={slot} className="box-border flex aspect-square items-end rounded-10 bg-track p-1.5 text-11 text-muted">
                  {t(`photos.${slot}`)}
                </div>
              );
            })}
          </div>
          <ul className="mt-3 mb-0 flex list-none flex-col gap-1.5 p-0">
            {props.docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 rounded-10 bg-paper px-3 py-2.5 text-13">
                <Icon name="file" size={16} />
                <span className="flex-1">{d.name}</span>
                <a href={`${d.url}?maqsad=open`} target="_blank" rel="noreferrer" className="font-bold text-blue no-underline">
                  {t("open")}
                </a>
              </li>
            ))}
          </ul>
        </>
      }
      right={<CheckTable rows={props.rows} />}
      actions={
        <>
          <Button variant="green" size="md" className="px-[22px]" disabled={pending || decided} aria-busy={pending} onClick={() => run(() => approveBusinessAction({ businessId: props.businessId }))}>
            <Icon name="check" size={18} strokeWidth={3} />
            {t("approve")}
          </Button>
          <div className="flex flex-col gap-1">
            <label htmlFor="reject-reason-biz" className="text-12 text-muted">
              {t("rejectReason")}
            </label>
            <div className="flex gap-1.5">
              <Select id="reject-reason-biz" native compact value={reason} onChange={(e) => setReason(e.target.value as BusinessRejectReason)} disabled={decided}>
                {BUSINESS_REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.business.${r}`)}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="md" disabled={pending || decided} aria-busy={pending} onClick={() => run(() => rejectBusinessAction({ businessId: props.businessId, reason }))}>
                {t("reject")}
              </Button>
            </div>
          </div>
          <Button
            variant="danger-outline"
            size="md"
            className="ml-auto"
            disabled={pending || props.state === "BLOCKED"} aria-busy={pending}
            onClick={() => {
              if (window.confirm(t("confirmBlockBusiness"))) run(() => blockBusinessAction({ businessId: props.businessId, reason }));
            }}
          >
            {t("block")}
          </Button>
          {error ? (
            <p role="alert" className="m-0 basis-full text-13 font-semibold text-danger">
              {error}
            </p>
          ) : null}
        </>
      }
      hint={t("hintBusinesses")}
    />
  );
}
