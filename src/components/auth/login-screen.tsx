"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { Field, PhoneInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { OtpInput } from "@/components/ui/otp-input";
import { Segmented } from "@/components/ui/segmented";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { requestCodeAction, verifyCodeAction, type AuthError } from "@/server/actions/auth";

type Role = "student" | "business";
type Failure = { error: AuthError; retryInSeconds?: number };

const RESEND_SECONDS = 60;
const OTP_LENGTH = 6;

// Chap paneldagi qiya kartochkalar (W2): [fon/matn, burilish]
const STUBS = {
  student: [
    ["bg-orange text-ink", "-rotate-5"],
    ["bg-white text-ink", "rotate-3"],
    ["bg-ink text-white", "-rotate-2"],
  ],
  business: [
    ["bg-orange text-ink", "-rotate-4"],
    ["bg-paper text-ink", "rotate-3"],
    ["bg-ink-3 text-white", "-rotate-2"],
  ],
} as const;

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** W2 / W2m — kirish: telefon → SMS kod. Talaba va biznes uchun bitta ekran, ikki mavzu. */
export function LoginScreen() {
  const t = useTranslations("auth");
  const [role, setRole] = useState<Role>("student");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [pending, startTransition] = useTransition();

  const business = role === "business";
  const cta = business ? "orange" : "blue";

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Formalar `action` orqali ulanadi: sahifa hali ulanmagan paytda bosilsa ham React yuborishni ushlab qoladi
  // (aks holda brauzer raqamni manzil satriga GET bilan yuborar edi).
  function sendCode() {
    setFailure(null);
    startTransition(async () => {
      const result = await requestCodeAction(phoneInput);
      if (!result.ok) {
        setFailure(result);
        // Kod yaqinda yuborilgan bo'lsa ham kiritish qadamiga o'tamiz — foydalanuvchida kod bor.
        if (result.error !== "tooSoon" || step === "code") return;
        setResendIn(result.retryInSeconds ?? RESEND_SECONDS);
      } else {
        setResendIn(RESEND_SECONDS);
        setPhone(result.phone);
      }
      setCode("");
      setStep("code");
    });
  }

  function verify(value: string) {
    setFailure(null);
    startTransition(async () => {
      // Muvaffaqiyatli bo'lsa server yo'naltiradi; bu yerga faqat xato qaytadi.
      const result = await verifyCodeAction(phoneInput, value, role);
      if (result) {
        setFailure(result);
        setCode("");
      }
    });
  }

  const errorText = failure ? t(`errors.${failure.error}`, { seconds: failure.retryInSeconds ?? 0 }) : null;

  return (
    <div className="@container flex min-h-screen flex-wrap bg-paper text-ink">
      <div
        className={cn(
          "relative box-border flex min-w-0 flex-[1_1_460px] flex-col gap-7 overflow-hidden p-[clamp(20px,4cqw,48px)]",
          business ? "bg-ink text-paper" : "bg-blue text-white",
        )}
      >
        <Link href="/" className="relative self-start text-inherit no-underline">
          <Logo size={20} chip={business ? "white" : "white-blue"} tag={business ? "BIZNES" : undefined} />
        </Link>
        <div className="relative mt-auto max-w-[520px]">
          <h1 className="m-0 text-[clamp(36px,4.6cqw,64px)] leading-[0.95] font-black tracking-[-0.04em] font-stretch-112%">
            {t(`${role}.headline`)}
          </h1>
          <p className="mt-4 mb-0 text-17 leading-[1.5] opacity-85">{t(`${role}.lead`)}</p>
        </div>
        <div aria-hidden="true" className="relative flex flex-wrap gap-2.5">
          {STUBS[role].map(([look, rotation], i) => (
            <div key={i} className={cn("flex min-w-[148px] flex-col gap-0.5 rounded-14 px-3.5 py-3", look, rotation)}>
              <span className="text-11 opacity-80">{t(`${role}.stubs.${(i + 1) as 1 | 2 | 3}.label`)}</span>
              <span className="text-30 leading-none font-black font-stretch-65%">
                {t(`${role}.stubs.${(i + 1) as 1 | 2 | 3}.value`)}
              </span>
            </div>
          ))}
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "absolute -top-[120px] -right-[120px] size-[460px] rounded-[180px] border-[50px] border-solid",
            business ? "border-ink-2" : "border-blue-2",
          )}
        />
      </div>

      <main className="box-border flex min-w-0 flex-[1_1_460px] items-center justify-center px-[clamp(16px,4cqw,48px)] py-[clamp(24px,5cqw,64px)]">
        <div className="flex w-full max-w-[440px] flex-col gap-5">
          <Segmented
            size="lg"
            label={t("roleLabel")}
            value={role}
            onChange={(next) => {
              setRole(next);
              setFailure(null);
            }}
            options={[
              { value: "student", label: <><Icon name="student" size={18} />{t("role.student")}</> },
              { value: "business", label: <><Icon name="store" size={18} />{t("role.business")}</> },
            ]}
          />

          <div>
            <h2 className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">{t(`${role}.title`)}</h2>
            <p className="mt-1.5 mb-0 text-15 text-muted">{t(`${role}.subtitle`)}</p>
          </div>

          {step === "phone" ? (
            <form
              className="flex flex-col gap-3.5"
              action={sendCode}
            >
              <Field label={t("phoneLabel")} htmlFor="login-phone" error={errorText}>
                <PhoneInput
                  id="login-phone"
                  name="phone"
                  size="lg"
                  autoFocus
                  invalid={failure?.error === "phone"}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
              </Field>
              <button type="submit" disabled={pending} className={buttonClass({ variant: cta, strong: true })}>
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
              <div className="flex flex-col gap-2">
                <span className="text-13 font-semibold">{t("codeSentTo", { phone: formatPhone(phone) })}</span>
                <OtpInput
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    if (next.length === OTP_LENGTH && !pending) verify(next);
                  }}
                  digitLabel={(n) => t("digit", { n })}
                  length={OTP_LENGTH}
                  invalid={failure?.error === "wrongCode"}
                  disabled={pending}
                  autoFocus
                />
                <div className="flex justify-between text-13 text-muted">
                  {resendIn > 0 ? (
                    <span>
                      {t("resendIn")} <b className="font-mono text-ink">{clock(resendIn)}</b>
                    </span>
                  ) : (
                    <button type="button" onClick={sendCode} disabled={pending} className="border-0 bg-transparent p-0 font-sans text-13 font-bold text-blue">
                      {t("resend")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setFailure(null);
                    }}
                    className="border-0 bg-transparent p-0 font-sans text-13 font-bold text-blue"
                  >
                    {t("changePhone")}
                  </button>
                </div>
                {errorText ? <p className="m-0 text-12 font-semibold text-danger">{errorText}</p> : null}
              </div>
              <button type="submit" disabled={pending} className={buttonClass({ variant: cta, strong: true })}>
                {pending ? t("checking") : t("submit")}
              </button>
            </form>
          )}

          <div className="flex items-center gap-3 text-13 text-muted">
            <span className="h-px flex-1 bg-line" />
            {t("or")}
            <span className="h-px flex-1 bg-line" />
          </div>

          <Link
            href={business ? "/biznes/royxat" : "/talaba/royxat"}
            className="box-content flex min-h-16 items-center gap-3.5 rounded-14 border-[1.5px] border-dashed border-placeholder bg-white px-4 py-2.5 text-ink no-underline"
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-10", business ? "bg-orange text-ink" : "bg-blue text-white")}>
              <Icon name="plus" size={18} strokeWidth={2.4} />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <b className="text-15">{t(`${role}.registerTitle`)}</b>
              <span className="text-13 text-muted">{t(`${role}.registerSubtitle`)}</span>
            </span>
            <Icon name="chevronRight" size={18} strokeWidth={2.2} />
          </Link>

          {business ? <p className="m-0 text-14 text-muted">{t("business.cashierNote")}</p> : null}

          <p className="m-0 text-13 leading-[1.5] text-muted">
            {t.rich("consent", {
              terms: (chunks) => <Link href="/huquqiy/shartlar" className="font-bold text-ink underline">{chunks}</Link>,
              privacy: (chunks) => <Link href="/huquqiy/maxfiylik" className="font-bold text-ink underline">{chunks}</Link>,
            })}
          </p>
        </div>
      </main>
    </div>
  );
}
