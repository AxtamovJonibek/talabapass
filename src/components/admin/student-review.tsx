"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";
import { approveStudentAction, blockStudentAction, rejectStudentAction, type ReviewResult } from "@/server/actions/admin-review";
import { STUDENT_REJECT_REASONS, type StudentRejectReason } from "@/server/admin/review-rules";
import { CheckTable, DetailCard, type CheckRow } from "./review-parts";

export type StudentReviewData = {
  verificationId: string;
  code: string;
  name: string;
  meta: string;
  photoUrl?: string | null;
  initials?: string;
  state: "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED";
  fileUrl: string;
  isPdf: boolean;
  fileCaption: string;
  /** Oldingi tasdiqdan (muddat yangilash) ma'lum bo'lgan guvohnoma raqami */
  knownCardNumber: string | null;
  rows: CheckRow[];
  /** Qarordan keyin ochiladigan keyingi ariza */
  nextHref: string;
  todayIso: string;
};

const cellInput = "box-border h-9 w-full min-w-0 rounded-8 border-hair border-line bg-white px-2 font-mono text-13 text-ink outline-none focus:border-ink";

/** A2 — talaba arizasi: guvohnoma rasmi, ma'lumotlar, tasdiqlash / rad etish / bloklash. */
export function StudentReview(props: StudentReviewData) {
  const t = useTranslations("admin.review");
  const router = useRouter();
  const [cardNumber, setCardNumber] = useState(props.knownCardNumber ?? "");
  const [expires, setExpires] = useState("");
  const [reason, setReason] = useState<StudentRejectReason>(STUDENT_REJECT_REASONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const decided = props.state !== "PENDING";

  function run(action: () => Promise<ReviewResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setError(t(`errors.${result.error === "invalid" ? "not_pending" : result.error}`));
      router.push(props.nextHref);
      router.refresh();
    });
  }

  // Muddat tekshiruvi kiritilishi bilan ko'rinadi; yakuniy tekshiruv serverda.
  const expiryCheck: CheckRow =
    expires === ""
      ? { key: "cardExpires", label: t("fields.cardExpires"), value: null, check: t("checks.fromImage"), tone: "muted" }
      : expires < props.todayIso
        ? { key: "cardExpires", label: t("fields.cardExpires"), value: null, check: t("checks.expired"), tone: "bad" }
        : { key: "cardExpires", label: t("fields.cardExpires"), value: null, check: t("checks.valid"), tone: "ok" };

  const rows: CheckRow[] = [
    ...props.rows,
    {
      key: "cardNumber",
      label: t("fields.cardNumber"),
      value: <input aria-label={t("fields.cardNumber")} value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} disabled={decided} className={cellInput} />,
      check: cardNumber ? t("checks.none") : t("checks.fromImage"),
      tone: "muted",
    },
    { ...expiryCheck, value: <input type="date" aria-label={t("fields.cardExpires")} value={expires} onChange={(e) => setExpires(e.target.value)} disabled={decided} className={cellInput} /> },
  ];

  return (
    <DetailCard
      code={props.code}
      name={props.name}
      meta={props.meta}
      photoUrl={props.photoUrl}
      initials={props.initials}
      state={t(`state.${props.state}`)}
      stateTone={props.state === "PENDING" ? "warn" : props.state === "APPROVED" ? "ok" : "bad"}
      left={
        <figure className="m-0 flex flex-col gap-2.5 rounded-14 bg-ink-1 p-[22px]">
          <div className="-rotate-[1.5deg] overflow-hidden rounded-10 bg-paper-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            {props.isPdf ? (
              <a href={`${props.fileUrl}?maqsad=pdf`} target="_blank" rel="noreferrer" className="tp-link flex h-40 items-center justify-center gap-2 text-14 font-bold text-ink">
                <Icon name="file" size={18} />
                {t("pdfPreview")}
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- himoyalangan, keshlanmaydigan manzil: next/image optimizatsiyasi kerak emas
              <img src={props.fileUrl} alt={props.fileCaption} className="block h-auto w-full" />
            )}
          </div>
          <figcaption className="flex justify-between gap-3 text-12 text-fog-3">
            <span>{props.fileCaption}</span>
            <a href={`${props.fileUrl}?maqsad=full`} target="_blank" rel="noreferrer" className="tp-link text-fog-3 no-underline">
              {t("zoom")}
            </a>
          </figcaption>
        </figure>
      }
      right={<CheckTable rows={rows} />}
      actions={
        <>
          <Button
            variant="green"
            size="md"
            className="px-[22px]"
            disabled={pending || decided} aria-busy={pending}
            onClick={() => run(() => approveStudentAction({ verificationId: props.verificationId, cardNumber, cardExpiresAt: expires }))}
          >
            <Icon name="check" size={18} strokeWidth={3} />
            {t("approve")}
          </Button>
          <div className="flex flex-col gap-1">
            <label htmlFor="reject-reason" className="text-12 text-muted">
              {t("rejectReason")}
            </label>
            <div className="flex gap-1.5">
              <Select id="reject-reason" native compact value={reason} onChange={(e) => setReason(e.target.value as StudentRejectReason)} disabled={decided}>
                {STUDENT_REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.student.${r}`)}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="md" disabled={pending || decided} aria-busy={pending} onClick={() => run(() => rejectStudentAction({ verificationId: props.verificationId, reason }))}>
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
              if (window.confirm(t("confirmBlockStudent"))) run(() => blockStudentAction({ verificationId: props.verificationId, reason }));
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
      hint={t("hintStudents")}
    />
  );
}
