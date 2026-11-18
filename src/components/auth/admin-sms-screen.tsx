"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BackLink } from "@/components/ui/back-button";
import { buttonClass } from "@/components/ui/button";
import { Field, PhoneInput } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";
import { adminVerifyCodeAction, requestCodeAction, type AuthFailure } from "@/server/actions/auth";
import { CodeEntry, OTP_LENGTH, RESEND_SECONDS } from "./code-entry";

/**
 * Admin kirishi, 1-qadam (dizaynda yo'q — admin parol ekrani uslubida): admin raqami → SMS kod → `/kirish/admin` dagi
 * umumiy admin paroli. Oddiy foydalanuvchilar sayt kirishida raqam/email + parol bilan kiradi.
 */
export function AdminSmsScreen() {
  const t = useTranslations("auth");
  const brand = useTranslations("brand");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<Pick<AuthFailure, "error" | "retryInSeconds"> | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const errorText = failure ? t(`errors.${failure.error}`, { seconds: failure.retryInSeconds ?? 0, minutes: Math.max(1, Math.ceil((failure.retryInSeconds ?? 0) / 60)), left: 0 }) : null;

  function send(raw: string) {
    setFailure(null);
    startTransition(async () => {
      const result = await requestCodeAction(raw);
      if (!result.ok && result.error !== "tooSoon") return setFailure(result);
      if (result.ok) setPhone(result.phone);
      setResendIn(result.ok ? RESEND_SECONDS : (result.retryInSeconds ?? RESEND_SECONDS));
      setCode("");
      setStep("code");
    });
  }

  function verify(value: string) {
    setFailure(null);
    startTransition(async () => {
      const result = await adminVerifyCodeAction(phone, value);
      if (result) {
        setFailure(result);
        setCode("");
      }
    });
  }

  return (
    <main className="box-border flex min-h-screen items-center justify-center bg-admin-bg px-[clamp(16px,4cqw,48px)] py-[clamp(24px,5cqw,64px)] text-ink">
      <div className="flex w-full max-w-[440px] flex-col gap-5">
        <BackLink href="/kirish" variant="text" className="-mb-3 self-start" />
        <Logo size={20} tag={brand("admin")} />
        <div>
          <h1 className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">{t("admin.smsTitle")}</h1>
          <p className="mt-1.5 mb-0 text-15 text-muted">{t("admin.smsSubtitle")}</p>
        </div>
        {step === "phone" ? (
          <form className="flex flex-col gap-3.5" action={(form) => send(String(form.get("phone") ?? ""))}>
            <Field label={t("phoneLabel")} htmlFor="admin-phone" error={errorText}>
              <PhoneInput id="admin-phone" name="phone" size="lg" autoFocus invalid={failure?.error === "phone"} />
            </Field>
            <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", strong: true })}>
              {pending ? t("sending") : t("sendCode")}
            </button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-3.5"
            action={() => {
              if (code.length === OTP_LENGTH) verify(code);
            }}
          >
            <CodeEntry
              phone={phone}
              code={code}
              onCode={setCode}
              onComplete={verify}
              onResend={() => send(phone)}
              onChangePhone={() => setStep("phone")}
              resendIn={resendIn}
              pending={pending}
              invalid={failure?.error === "wrongCode"}
              errorText={errorText}
            />
            <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", strong: true })}>
              {pending ? t("checking") : t("confirmCode")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
