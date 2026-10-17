"use client";

import { BackButton } from "@/components/ui/back-button";
import { useTranslations } from "next-intl";
import { CodeEntry, OTP_LENGTH } from "@/components/auth/code-entry";
import { buttonClass } from "@/components/ui/button";
import { ToggleSquare } from "@/components/ui/chip";
import { Field, Input, PhoneInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import { formatPhone } from "@/lib/format";
import type { UniversityOption } from "@/lib/universities";
import { COURSES, type Registration } from "./use-registration";
import { UniversityPicker } from "./university-picker";

export type RegisterViewProps = {
  registration: Registration;
  universities: UniversityOption[];
  /** Kirish sahifasida SMS bilan tasdiqlangan raqam (bo'lsa — o'zgartirib bo'lmaydi, kod qayta so'ralmaydi) */
  verifiedPhone: string | null;
};

/** T1 — talaba ro'yxati, 1-qadam (telefon ko'rinishi). */
export function RegisterMobile({ registration: r, universities, verifiedPhone }: RegisterViewProps) {
  const t = useTranslations("onboarding");
  const auth = useTranslations("auth");
  const course = useTranslations("course");
  const submitClass = buttonClass({ variant: "blue", spread: true, block: true });

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div className="relative bg-ink px-6 pt-14 text-paper">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton tone="dark" onClick={r.backToForm} />
            <Logo size={18} />
          </div>
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

      {r.codePhone ? (
        <form
          className="flex flex-1 flex-col"
          action={() => {
            if (r.code.length === OTP_LENGTH) r.submitCode(r.code);
          }}
        >
          <div className="flex-1 px-6 pt-[26px]">
            <CodeEntry
              phone={r.codePhone}
              code={r.code}
              onCode={r.setCode}
              onComplete={r.submitCode}
              onResend={r.resend}
              onChangePhone={r.backToForm}
              resendIn={r.resendIn}
              pending={r.pending}
              invalid={r.failure?.error === "wrongCode"}
              errorText={r.errorText}
            />
          </div>
          <div className="flex flex-col gap-3 px-6 pt-4 pb-[34px]">
            <button type="submit" disabled={r.pending} aria-busy={r.pending} className={submitClass}>
              <span>{r.pending ? auth("checking") : t("register.confirm")}</span>
              <Icon name="arrowRight" size={22} />
            </button>
          </div>
        </form>
      ) : (
        <form className="flex flex-1 flex-col" action={r.submitForm}>
          <div className="flex flex-1 flex-col gap-3.5 px-6 pt-[26px]">
            <Field label={t("register.phone")} htmlFor="reg-phone" error={r.fieldError("phone") ?? r.errorText}>
              <PhoneInput
                id="reg-phone"
                name="phone"
                defaultValue={verifiedPhone ? formatPhone(verifiedPhone).replace("+998 ", "") : r.values?.phone}
                readOnly={Boolean(verifiedPhone)}
                invalid={r.invalid.includes("phone")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label={t("register.firstName")} htmlFor="reg-first" error={r.fieldError("firstName")}>
                <Input id="reg-first" name="firstName" autoComplete="given-name" defaultValue={r.values?.firstName} invalid={r.invalid.includes("firstName")} />
              </Field>
              <Field label={t("register.lastName")} htmlFor="reg-last" error={r.fieldError("lastName")}>
                <Input
                  id="reg-last"
                  name="lastName"
                  autoComplete="family-name"
                  placeholder={t("register.lastNamePlaceholder")}
                  defaultValue={r.values?.lastName}
                  invalid={r.invalid.includes("lastName")}
                />
              </Field>
            </div>
            <Field label={t("register.university")} htmlFor="reg-uni" error={r.fieldError("universityId") ?? r.fieldError("universityOther")}>
              <UniversityPicker
                id="reg-uni"
                universities={universities}
                defaultId={r.values?.universityId}
                defaultOther={r.values?.universityOther}
                invalid={r.invalid.includes("universityId")}
                otherInvalid={r.invalid.includes("universityOther")}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-13 font-semibold">{course("label")}</span>
              <input type="hidden" name="course" value={r.course} />
              <div className="grid grid-cols-5 gap-1.5">
                {COURSES.map((c) => (
                  <ToggleSquare key={c} selected={r.course === c} onClick={() => r.pickCourse(c)} textSize={c === "MASTER" ? 13 : 15}>
                    {course(c)}
                  </ToggleSquare>
                ))}
              </div>
              {r.fieldError("course") ? <p className="m-0 text-12 font-semibold text-danger">{r.fieldError("course")}</p> : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 px-6 pt-4 pb-[34px]">
            <button type="submit" disabled={r.pending} aria-busy={r.pending} className={submitClass}>
              <span>{r.pending ? auth("sending") : t("register.submit")}</span>
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
