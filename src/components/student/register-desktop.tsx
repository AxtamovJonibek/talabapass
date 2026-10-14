"use client";

import { useTranslations } from "next-intl";
import { CodeEntry, OTP_LENGTH } from "@/components/auth/code-entry";
import { Button } from "@/components/ui/button";
import { ToggleSquare } from "@/components/ui/chip";
import { Field, Input, PhoneInput, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { formatPhone } from "@/lib/format";
import { OnboardingHeading, OnboardingShell } from "./onboarding-shell";
import type { RegisterViewProps } from "./register-form";
import { COURSES } from "./use-registration";

const FORM_ID = "register-web";

/** WT1 (1-qadam) — talaba ro'yxati, veb ko'rinishi. */
export function RegisterDesktop({ registration: r, universities, verifiedPhone }: RegisterViewProps) {
  const t = useTranslations("onboarding");
  const auth = useTranslations("auth");
  const course = useTranslations("course");
  const inCode = Boolean(r.codePhone);

  return (
    <OnboardingShell
      step={1}
      showLogin
      footer={
        <>
          {/* 1-qadamda ortga yo'l yo'q (dizayndagidek xira); kod qadamida — formaga qaytaradi */}
          <Button variant={inCode ? "outline-soft" : "outline-idle"} size="wide-quiet" aria-disabled={!inCode} onClick={inCode ? r.backToForm : undefined}>
            {t("web.back")}
          </Button>
          <Button type="submit" form={FORM_ID} variant="blue" size="wide" strong disabled={r.pending} className="gap-2.5">
            {r.pending ? auth(inCode ? "checking" : "sending") : inCode ? t("register.confirm") : t("register.submit")}
            <Icon name="arrowRight" size={18} strokeWidth={2.2} />
          </Button>
        </>
      }
    >
      {r.codePhone ? (
        <form
          id={FORM_ID}
          className="flex flex-col gap-4"
          action={() => {
            if (r.code.length === OTP_LENGTH) r.submitCode(r.code);
          }}
        >
          <OnboardingHeading>{t("web.codeTitle")}</OnboardingHeading>
          <div className="max-w-[440px]">
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
        </form>
      ) : (
        <form id={FORM_ID} className="flex flex-col gap-4" action={r.submitForm}>
          <OnboardingHeading>{t("web.personalTitle")}</OnboardingHeading>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3.5">
            <Field label={t("register.phone")} htmlFor="web-phone" error={r.fieldError("phone") ?? r.errorText}>
              <PhoneInput
                id="web-phone"
                name="phone"
                size="web"
                defaultValue={verifiedPhone ? formatPhone(verifiedPhone).replace("+998 ", "") : r.values?.phone}
                readOnly={Boolean(verifiedPhone)}
                invalid={r.invalid.includes("phone")}
              />
            </Field>
            <Field label={t("register.university")} htmlFor="web-uni" error={r.fieldError("universityId")}>
              <Select id="web-uni" name="universityId" native defaultValue={r.values?.universityId ?? universities[0]?.id} invalid={r.invalid.includes("universityId")}>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("register.firstName")} htmlFor="web-first" error={r.fieldError("firstName")}>
              <Input id="web-first" name="firstName" autoComplete="given-name" defaultValue={r.values?.firstName} invalid={r.invalid.includes("firstName")} />
            </Field>
            <Field label={t("register.lastName")} htmlFor="web-last" error={r.fieldError("lastName")}>
              <Input id="web-last" name="lastName" autoComplete="family-name" defaultValue={r.values?.lastName} invalid={r.invalid.includes("lastName")} />
            </Field>
          </div>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 p-0 text-13 font-semibold">{course("label")}</legend>
            <input type="hidden" name="course" value={r.course} />
            <div className="flex flex-wrap gap-1.5">
              {COURSES.map((c) => (
                <ToggleSquare key={c} wide selected={r.course === c} onClick={() => r.pickCourse(c)}>
                  {c === "MASTER" ? course("MASTER_long") : course(c)}
                </ToggleSquare>
              ))}
            </div>
            {r.fieldError("course") ? <p className="mt-1.5 mb-0 text-12 font-semibold text-danger">{r.fieldError("course")}</p> : null}
          </fieldset>
        </form>
      )}
    </OnboardingShell>
  );
}
