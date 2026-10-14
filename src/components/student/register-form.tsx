"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { ToggleSquare } from "@/components/ui/chip";
import { Field, Input, PhoneInput, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { OtpInput } from "@/components/ui/otp-input";
import { Link } from "@/i18n/navigation";
import { formatPhone } from "@/lib/format";
import type { AuthError } from "@/server/actions/auth";
import { registerStudentAction, type RegisterField } from "@/server/actions/student-register";

const COURSES = ["C1", "C2", "C3", "C4", "MASTER"] as const;
type Course = (typeof COURSES)[number];
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type Props = {
  universities: { id: string; name: string }[];
  /** Kirish sahifasida SMS bilan tasdiqlangan raqam (bo'lsa — qayta kod so'ralmaydi) */
  verifiedPhone: string | null;
};

type Values = { phone: string; firstName: string; lastName: string; universityId: string; course: string };

/** T1 — talaba ro'yxati, 1-qadam. Raqam tasdiqlanmagan bo'lsa shu yerning o'zida SMS kod so'raladi. */
export function RegisterForm({ universities, verifiedPhone }: Props) {
  const t = useTranslations("onboarding");
  const auth = useTranslations("auth");
  const course = useTranslations("course");
  const [picked, setPicked] = useState<Course | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [invalid, setInvalid] = useState<RegisterField[]>([]);
  const [failure, setFailure] = useState<{ error: AuthError; retryInSeconds?: number } | null>(null);
  const [codePhone, setCodePhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function submit(next: Values, otp?: string) {
    setValues(next);
    setInvalid([]);
    setFailure(null);
    startTransition(async () => {
      // Muvaffaqiyatli ro'yxatda server keyingi qadamga yo'naltiradi; bu yerga faqat oraliq natija qaytadi.
      const result = await registerStudentAction({ ...next, code: otp });
      if (!result) return;
      if (result.ok) {
        setCodePhone(result.phone);
        setCode("");
        setResendIn(result.retryInSeconds ?? RESEND_SECONDS);
      } else if ("fields" in result) {
        setInvalid(result.fields);
      } else {
        setFailure(result);
        setCode("");
      }
    });
  }

  const errorText = failure
    ? auth(`errors.${failure.error}`, { seconds: failure.retryInSeconds ?? 0, minutes: Math.ceil((failure.retryInSeconds ?? 0) / 60) })
    : null;
  const fieldError = (field: RegisterField) => (invalid.includes(field) ? t(`register.errors.${field}`) : undefined);

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div className="relative bg-ink px-6 pt-14 text-paper">
        <div className="flex items-center justify-between">
          <Logo size={18} />
          <div className="font-mono text-12 text-fog-2">{t("step", { n: 1 })}</div>
        </div>
        <h1 className="mt-7 mb-0 text-40 leading-[0.98] font-black tracking-[-0.035em] font-stretch-112%">
          {t.rich("register.title", { br: () => <br /> })}
        </h1>
        <p className="mt-3.5 mb-0 max-w-[300px] text-15 leading-[1.45] text-fog-0">{t("register.lead")}</p>
        <div className="mt-[22px] flex gap-1.5 pb-[22px]">
          <div className="h-1 flex-1 rounded-2 bg-orange" />
          <div className="h-1 flex-1 rounded-2 bg-ink-6" />
          <div className="h-1 flex-1 rounded-2 bg-ink-6" />
        </div>
        <div className="ticket-scallop" />
      </div>

      {codePhone && values ? (
        <form
          className="flex flex-1 flex-col"
          action={() => {
            if (code.length === OTP_LENGTH) submit(values, code);
          }}
        >
          <div className="flex flex-1 flex-col gap-2 px-6 pt-[26px]">
            <span className="text-13 font-semibold">{auth("codeSentTo", { phone: formatPhone(codePhone) })}</span>
            <OtpInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (next.length === OTP_LENGTH && !pending) submit(values, next);
              }}
              digitLabel={(n) => auth("digit", { n })}
              length={OTP_LENGTH}
              invalid={failure?.error === "wrongCode"}
              disabled={pending}
              autoFocus
            />
            <div className="flex justify-between text-13 text-muted">
              {resendIn > 0 ? (
                <span>
                  {auth("resendIn")} <b className="font-mono text-ink">{clock(resendIn)}</b>
                </span>
              ) : (
                <button type="button" onClick={() => submit(values)} disabled={pending} className="border-0 bg-transparent p-0 font-sans text-13 font-bold text-blue">
                  {auth("resend")}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCodePhone(null);
                  setFailure(null);
                }}
                className="border-0 bg-transparent p-0 font-sans text-13 font-bold text-blue"
              >
                {auth("changePhone")}
              </button>
            </div>
            {errorText ? <p className="m-0 text-12 font-semibold text-danger">{errorText}</p> : null}
          </div>
          <div className="flex flex-col gap-3 px-6 pt-4 pb-[34px]">
            <button type="submit" disabled={pending} className={buttonClass({ variant: "blue", spread: true, block: true })}>
              <span>{pending ? auth("checking") : t("register.confirm")}</span>
              <Icon name="arrowRight" size={22} />
            </button>
          </div>
        </form>
      ) : (
        // Qiymatlar formaning o'zidan o'qiladi: sahifa ulanmasdan oldin yozilgan matn ham yo'qolmaydi.
        <form
          className="flex flex-1 flex-col"
          action={(form) =>
            submit({
              phone: verifiedPhone ?? String(form.get("phone") ?? ""),
              firstName: String(form.get("firstName") ?? ""),
              lastName: String(form.get("lastName") ?? ""),
              universityId: String(form.get("universityId") ?? ""),
              course: String(form.get("course") ?? ""),
            })
          }
        >
          <div className="flex flex-1 flex-col gap-3.5 px-6 pt-[26px]">
            <Field label={t("register.phone")} htmlFor="reg-phone" error={fieldError("phone") ?? errorText}>
              <PhoneInput
                id="reg-phone"
                name="phone"
                defaultValue={verifiedPhone ? formatPhone(verifiedPhone).replace("+998 ", "") : values?.phone}
                readOnly={Boolean(verifiedPhone)}
                invalid={invalid.includes("phone")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label={t("register.firstName")} htmlFor="reg-first" error={fieldError("firstName")}>
                <Input id="reg-first" name="firstName" autoComplete="given-name" defaultValue={values?.firstName} invalid={invalid.includes("firstName")} />
              </Field>
              <Field label={t("register.lastName")} htmlFor="reg-last" error={fieldError("lastName")}>
                <Input
                  id="reg-last"
                  name="lastName"
                  autoComplete="family-name"
                  placeholder={t("register.lastNamePlaceholder")}
                  defaultValue={values?.lastName}
                  invalid={invalid.includes("lastName")}
                />
              </Field>
            </div>
            <Field label={t("register.university")} htmlFor="reg-uni" error={fieldError("universityId")}>
              <Select id="reg-uni" name="universityId" defaultValue={values?.universityId ?? universities[0]?.id} invalid={invalid.includes("universityId")}>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-13 font-semibold">{course("label")}</span>
              <input type="hidden" name="course" value={picked ?? values?.course ?? ""} />
              <div className="grid grid-cols-5 gap-1.5">
                {COURSES.map((c) => (
                  <ToggleSquare
                    key={c}
                    selected={(picked ?? values?.course) === c}
                    onClick={() => setPicked(c)}
                    textSize={c === "MASTER" ? 13 : 15}
                  >
                    {course(c)}
                  </ToggleSquare>
                ))}
              </div>
              {fieldError("course") ? <p className="m-0 text-12 font-semibold text-danger">{fieldError("course")}</p> : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 px-6 pt-4 pb-[34px]">
            <button type="submit" disabled={pending} className={buttonClass({ variant: "blue", spread: true, block: true })}>
              <span>{pending ? auth("sending") : t("register.submit")}</span>
              <Icon name="arrowRight" size={22} />
            </button>
            <p className="m-0 text-center text-13 text-muted">
              {t.rich("register.haveAccount", {
                login: (chunks) => (
                  <Link href="/kirish" className="font-semibold text-blue underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
