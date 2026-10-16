"use client";

import { BackButton } from "@/components/ui/back-button";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CodeEntry, OTP_LENGTH } from "@/components/auth/code-entry";
import { buttonClass } from "@/components/ui/button";
import { Field, IconInput, Input, PhoneInput, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { DESCRIPTION_MAX } from "@/lib/business";
import { phoneNational } from "@/lib/format";
import { Consent, DocTiles, FormStatus, KindPicker, LogoPicker } from "./form-parts";
import type { BusinessRegistration } from "./use-business-registration";

/** Rad etilgan ariza: sabab va qayta yuborish taklifi (dizaynda chizilmagan — A2 rad etish holati ranglarida). */
export function RejectedNote({ reason }: { reason: string }) {
  const t = useTranslations("businessOnboarding");
  return (
    <div role="status" className="flex flex-col gap-1 rounded-14 bg-danger-bg px-4 py-3 text-danger">
      <b className="text-14">{t("rejectedTitle")}</b>
      <span className="text-13 leading-[1.45]">{t("rejectedLead", { reason })}</span>
    </div>
  );
}

/** B1 sarlavhasi: logotip + BIZNES, qadam, katta sarlavha. */
function Header({ step, onBack }: { step: 1 | 2; onBack: () => void }) {
  const t = useTranslations("businessOnboarding");
  const brand = useTranslations("brand");
  return (
    <>
      <div className="flex items-center justify-between px-5 pt-14">
        <div className="flex items-center gap-2.5">
          <BackButton onClick={onBack} />
          <Logo size={17} chip="ink" tag={brand("business")} tagSize="md" />
        </div>
        <div className="font-mono text-12 text-muted">{t("step", { n: step })}</div>
      </div>
      <div className="px-5 pt-[18px]">
        <h1 className="m-0 text-28 leading-[1.02] font-black tracking-[-0.03em] font-stretch-110%">{t.rich("mobileTitle", { br: () => <br /> })}</h1>
        <p className="mt-2 mb-0 text-14 text-muted">{t("mobileLead")}</p>
      </div>
    </>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="flex gap-2.5 border-t border-solid border-line-soft px-5 pt-3 pb-8">{children}</div>;
}

/** B1 — biznes ro'yxati (telefon): 1/2 — biznes haqida (dizayn), 2/2 — hujjatlar (dizaynda yo'q, WB1 2-qadamidan). */
export function RegisterMobile({ r, rejectReason }: { r: BusinessRegistration; rejectReason?: string | null }) {
  const t = useTranslations("businessOnboarding");
  const auth = useTranslations("auth");
  const v = r.values;
  const cta = buttonClass({ variant: "orange", spread: true, block: true });
  const back = buttonClass({ variant: "outline-soft", size: "lg" });
  const busy = r.pending ? (r.progress ? t("uploading", { done: r.progress.done + 1, total: r.progress.total }) : t("saving")) : null;

  if (r.codePhone) {
    return (
      <form
        className="flex min-h-dvh flex-col bg-paper text-ink"
        action={() => {
          if (r.code.length === OTP_LENGTH) r.submitCode(r.code, "phone");
        }}
      >
        <Header step={2} onBack={r.back} />
        <div className="flex-1 px-5 pt-5">
          <CodeEntry
            phone={r.codePhone}
            code={r.code}
            onCode={r.setCode}
            onComplete={(code) => r.submitCode(code, "phone")}
            onResend={() => r.resend("phone")}
            onChangePhone={r.back}
            resendIn={r.resendIn}
            pending={r.pending}
            invalid={r.failure?.kind === "auth" && r.failure.error === "wrongCode"}
            errorText={r.failureText}
          />
        </div>
        <Footer>
          <button type="submit" disabled={r.pending} className={cta}>
            <span>{r.pending ? auth("checking") : t("confirm")}</span>
            <Icon name="arrowRight" size={22} strokeWidth={2.2} />
          </button>
        </Footer>
      </form>
    );
  }

  if (r.step === 1) {
    return (
      <form className="flex min-h-dvh flex-col bg-paper text-ink" action={(form) => r.next(form, "phone")}>
        <Header step={1} onBack={r.back} />
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pt-4 pb-4">
          {rejectReason ? <RejectedNote reason={rejectReason} /> : null}
          <div className="flex items-end gap-3">
            <LogoPicker r={r} size="phone" />
            <Field label={t("name")} htmlFor="b1-name" error={r.fieldError("name")} className="flex-1">
              <Input id="b1-name" name="name" dense autoComplete="organization" defaultValue={v.name} invalid={r.invalid.includes("name")} />
            </Field>
          </div>
          <KindPicker r={r} size="phone" />
          <Field label={t("address")} htmlFor="b1-address" error={r.fieldError("address")}>
            <IconInput
              id="b1-address"
              name="address"
              autoComplete="street-address"
              defaultValue={v.address}
              invalid={r.invalid.includes("address")}
              icon={<Icon name="pin" size={18} className="shrink-0 text-rust" />}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label={t("workingHours")} htmlFor="b1-hours" error={r.fieldError("workingHours")}>
              <Input
                id="b1-hours"
                name="workingHours"
                dense
                mono={14}
                placeholder={t("workingHoursPlaceholder")}
                defaultValue={v.workingHours}
                invalid={r.invalid.includes("workingHours")}
              />
            </Field>
            <Field label={t("tin")} htmlFor="b1-tin" error={r.fieldError("tin")}>
              <Input
                id="b1-tin"
                name="tin"
                dense
                mono={14}
                inputMode="numeric"
                placeholder={t("tinPlaceholder")}
                defaultValue={v.tin}
                invalid={r.invalid.includes("tin")}
              />
            </Field>
          </div>
          <Field label={t("description")} htmlFor="b1-desc" counter={`${r.descriptionLength}/${DESCRIPTION_MAX}`} error={r.fieldError("description")}>
            <Textarea
              id="b1-desc"
              name="description"
              rows={2}
              maxLength={DESCRIPTION_MAX}
              defaultValue={v.description}
              onInput={(e) => r.setDescriptionLength(e.currentTarget.value.length)}
              invalid={r.invalid.includes("description")}
            />
          </Field>
        </div>
        <Footer>
          <button type="submit" className={cta}>
            <span>{t("next")}</span>
            <Icon name="arrowRight" size={22} strokeWidth={2.2} />
          </button>
        </Footer>
      </form>
    );
  }

  return (
    <form className="flex min-h-dvh flex-col bg-paper text-ink" action={(form) => r.submit(form, "phone")}>
      <Header step={2} onBack={r.back} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pt-4 pb-4">
        <h2 className="m-0 text-20 font-black tracking-[-0.02em] font-stretch-110%">{t("docsTitle")}</h2>
        <Field label={t("contactName")} htmlFor="b1-contact" error={r.fieldError("contactName")}>
          <Input id="b1-contact" name="contactName" dense autoComplete="name" defaultValue={v.contactName} invalid={r.invalid.includes("contactName")} />
        </Field>
        <Field label={t("phone")} htmlFor="b1-phone" error={r.fieldError("phone")}>
          <PhoneInput id="b1-phone" name="phone" quiet defaultValue={phoneNational(v.phone)} readOnly={r.phoneLocked} invalid={r.invalid.includes("phone")} />
        </Field>
        <DocTiles r={r} />
        <Consent r={r} />
        <FormStatus r={r} />
      </div>
      <Footer>
        <button type="button" onClick={r.back} disabled={r.pending} className={back}>
          {t("back")}
        </button>
        <button type="submit" disabled={r.pending} className={buttonClass({ variant: "orange", spread: true }, "flex-1")}>
          <span>{busy ?? t("submit")}</span>
          <Icon name="arrowRight" size={22} strokeWidth={2.2} />
        </button>
      </Footer>
    </form>
  );
}
