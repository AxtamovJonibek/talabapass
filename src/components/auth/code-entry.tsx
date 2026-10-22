"use client";

import { useTranslations } from "next-intl";
import { OtpInput } from "@/components/ui/otp-input";
import { formatPhone } from "@/lib/format";

export const OTP_LENGTH = 6;
export const RESEND_SECONDS = 60;

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const textButton = "tp-link border-0 bg-transparent p-0 font-sans text-13 font-bold text-blue";

type Props = {
  /** Kod yuborilgan raqam (E.164) */
  phone: string;
  code: string;
  onCode: (code: string) => void;
  /** 6 raqam to'liq kiritilganda */
  onComplete: (code: string) => void;
  onResend: () => void;
  onChangePhone: () => void;
  /** Qayta yuborishgacha qolgan soniyalar (0 — "Qayta yuborish" tugmasi) */
  resendIn: number;
  pending: boolean;
  invalid?: boolean;
  errorText?: string | null;
};

/** SMS kodni kiritish bloki (W2 dagi kod qadami) — kirish va ro'yxat formalarida bir xil. */
export function CodeEntry({ phone, code, onCode, onComplete, onResend, onChangePhone, resendIn, pending, invalid, errorText }: Props) {
  const t = useTranslations("auth");

  return (
    <div className="flex flex-col gap-2">
      <span className="text-13 font-semibold">{t("codeSentTo", { phone: formatPhone(phone) })}</span>
      <OtpInput
        value={code}
        onChange={(next) => {
          onCode(next);
          if (next.length === OTP_LENGTH && !pending) onComplete(next);
        }}
        digitLabel={(n) => t("digit", { n })}
        length={OTP_LENGTH}
        invalid={invalid}
        disabled={pending} aria-busy={pending}
        autoFocus
      />
      <div className="flex justify-between text-13 text-muted">
        {resendIn > 0 ? (
          <span>
            {t("resendIn")} <b className="font-mono text-ink">{clock(resendIn)}</b>
          </span>
        ) : (
          <button type="button" onClick={onResend} disabled={pending} aria-busy={pending} className={textButton}>
            {t("resend")}
          </button>
        )}
        <button type="button" onClick={onChangePhone} className={textButton}>
          {t("changePhone")}
        </button>
      </div>
      {errorText ? <p className="m-0 text-12 font-semibold text-danger">{errorText}</p> : null}
    </div>
  );
}
