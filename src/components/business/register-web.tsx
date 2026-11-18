"use client";

import { useTranslations } from "next-intl";
import { CodeEntry, OTP_LENGTH } from "@/components/auth/code-entry";
import { Button } from "@/components/ui/button";
import { Field, Input, PhoneInput, Textarea } from "@/components/ui/field";
import { DESCRIPTION_MAX } from "@/lib/business";
import { phoneNational } from "@/lib/format";
import { Consent, DocTiles, FormStatus, KindPicker, LogoPicker } from "./form-parts";
import { BusinessHeading, BusinessOnboardingShell } from "./onboarding-shell";
import { RejectedNote } from "./register-mobile";
import type { BusinessRegistration } from "./use-business-registration";

const FORM_ID = "business-register-web";

/** WB1 (1–2-qadam) — biznes ro'yxati, veb ko'rinishi. */
export function RegisterWeb({ r, rejectReason }: { r: BusinessRegistration; rejectReason?: string | null }) {
  const t = useTranslations("businessOnboarding");
  const auth = useTranslations("auth");
  const v = r.values;
  const inCode = Boolean(r.codePhone);
  const first = r.step === 1 && !inCode;

  const label = r.pending ? (r.progress ? t("uploading", { done: r.progress.done + 1, total: r.progress.total }) : inCode ? auth("checking") : t("saving")) : first ? t("next") : inCode ? t("confirm") : t("submit");

  return (
    <BusinessOnboardingShell
      step={r.step}
      showLogin={!r.signedIn}
      footer={
        <>
          <Button variant="outline-soft" size="tall-quiet" onClick={r.back}>
            {t("back")}
          </Button>
          <Button type="submit" form={FORM_ID} variant="orange" size="tall" disabled={r.pending} aria-busy={r.pending}>
            {label}
          </Button>
        </>
      }
    >
      {inCode && r.codePhone ? (
        <form
          id={FORM_ID}
          className="flex flex-col gap-4"
          action={() => {
            if (r.code.length === OTP_LENGTH) r.submitCode(r.code, "web");
          }}
        >
          <BusinessHeading>{t("codeTitle")}</BusinessHeading>
          <div className="max-w-[440px]">
            <CodeEntry
              phone={r.codePhone}
              code={r.code}
              onCode={r.setCode}
              onComplete={(code) => r.submitCode(code, "web")}
              onResend={() => r.resend("web")}
              onChangePhone={r.back}
              resendIn={r.resendIn}
              pending={r.pending}
              invalid={r.failure?.kind === "auth" && r.failure.error === "wrongCode"}
              errorText={r.failureText}
            />
          </div>
        </form>
      ) : r.step === 1 ? (
        <form id={FORM_ID} className="flex flex-col gap-4" action={(form) => r.next(form, "web")}>
          {rejectReason ? <RejectedNote reason={rejectReason} /> : null}
          <BusinessHeading>{t("infoTitle")}</BusinessHeading>
          <div className="flex flex-wrap items-end gap-3.5">
            <LogoPicker r={r} size="web" />
            <Field label={t("name")} htmlFor="wb-name" error={r.fieldError("name")} className="flex-[1_1_240px]">
              <Input id="wb-name" name="name" autoComplete="organization" defaultValue={v.name} invalid={r.invalid.includes("name")} />
            </Field>
          </div>
          <KindPicker r={r} size="web" />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3.5">
            <Field label={t("address")} htmlFor="wb-address" error={r.fieldError("address")}>
              <Input id="wb-address" name="address" autoComplete="street-address" defaultValue={v.address} invalid={r.invalid.includes("address")} />
            </Field>
            <Field label={t("workingHours")} htmlFor="wb-hours" error={r.fieldError("workingHours")}>
              <Input
                id="wb-hours"
                name="workingHours"
                mono={14}
                placeholder={t("workingHoursPlaceholder")}
                defaultValue={v.workingHours}
                invalid={r.invalid.includes("workingHours")}
              />
            </Field>
          </div>
          <Field
            label={t("description")}
            htmlFor="wb-desc"
            counter={`${r.descriptionLength}/${DESCRIPTION_MAX}`}
            error={r.fieldError("description")}
          >
            <Textarea
              id="wb-desc"
              name="description"
              rows={3}
              resizable
              maxLength={DESCRIPTION_MAX}
              defaultValue={v.description}
              onInput={(e) => r.setDescriptionLength(e.currentTarget.value.length)}
              invalid={r.invalid.includes("description")}
            />
          </Field>
        </form>
      ) : (
        <form id={FORM_ID} className="flex flex-col gap-4" action={(form) => r.submit(form, "web")}>
          <BusinessHeading>{t("docsTitle")}</BusinessHeading>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3.5">
            <Field label={t("tin")} htmlFor="wb-tin" error={r.fieldError("tin")}>
              <Input
                id="wb-tin"
                name="tin"
                inputMode="numeric"
                mono={15}
                placeholder={t("tinPlaceholder")}
                defaultValue={v.tin}
                invalid={r.invalid.includes("tin")}
              />
            </Field>
            <Field label={t("contactName")} htmlFor="wb-contact" error={r.fieldError("contactName")}>
              <Input id="wb-contact" name="contactName" autoComplete="name" defaultValue={v.contactName} invalid={r.invalid.includes("contactName")} />
            </Field>
            <Field label={t("phone")} htmlFor="wb-phone" error={r.fieldError("phone")}>
              <PhoneInput
                id="wb-phone"
                name="phone"
                size="web"
                quiet
                defaultValue={phoneNational(v.phone)}
                readOnly={r.phoneLocked}
                invalid={r.invalid.includes("phone")}
              />
            </Field>
          </div>
          <DocTiles r={r} />
          <Consent r={r} />
          <FormStatus r={r} />
        </form>
      )}
    </BusinessOnboardingShell>
  );
}
