"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CodeBoxes } from "@/components/ui/app-code";
import { AppLabel, AppScreen, BoxInput, Choice, FieldBox, FieldNote, Highlight } from "@/components/ui/app-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { COURSES, useRegistration } from "@/components/student/use-registration";
import { UniversityPicker } from "@/components/student/university-picker";
import type { UniversityOption } from "@/lib/universities";
import { RegisterTitle, RegisterTop } from "./register-parts";

const OTP_LENGTH = 6;

/**
 * 8 · Talaba 1/3: ism, familiya, universitet, kurs (design/app-flow RoyxatTalaba). Holat va server — saytdagi T1 bilan bitta
 * (`useRegistration`, `registerStudentAction`); raqam kirishda tasdiqlangan, parol shu yerda hisobga yoziladi.
 */
export function AppStudentRegister({ universities, verifiedPhone }: { universities: UniversityOption[]; verifiedPhone: string | null }) {
  const t = useTranslations("app.register.student");
  const form = useTranslations("onboarding.register");
  const auth = useTranslations("auth");
  const course = useTranslations("course");
  const r = useRegistration(verifiedPhone);
  const cta = buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-6");

  // Tasdiq muddati o'tgan bo'lsa (30 daqiqa) server yana SMS kod so'raydi
  if (r.codePhone) {
    return (
      <AppScreen>
        <RegisterTop role="student" step={1} back={{ onClick: r.backToForm }} />
        <form
          className="flex flex-1 flex-col"
          action={() => {
            if (r.code.length === OTP_LENGTH) r.submitCode(r.code);
          }}
        >
          <p className="mt-8 mb-4 text-16 leading-[1.5] text-ink-5">{auth("codeSentTo", { phone: r.codePhone })}</p>
          <CodeBoxes
            id="app-reg-code"
            label={auth("digit", { n: 1 })}
            value={r.code}
            onChange={(next) => {
              r.setCode(next);
              if (next.length === OTP_LENGTH && !r.pending) r.submitCode(next);
            }}
            invalid={r.failure?.error === "wrongCode"}
            disabled={r.pending}
            autoFocus
          />
          {r.errorText ? <FieldNote error>{r.errorText}</FieldNote> : null}
          <div className="flex-1" />
          <button type="submit" disabled={r.pending} aria-busy={r.pending} className={cta}>
            {r.pending ? auth("checking") : form("confirm")}
            <Icon name="tick" size={22} strokeWidth={2.4} />
          </button>
        </form>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <RegisterTop role="student" step={1} back={{ href: "/kirish" }} />
      <RegisterTitle eyebrow={t("eyebrow1")}>{t.rich("title1", { hl: (chunks: ReactNode) => <Highlight tone="green">{chunks}</Highlight> })}</RegisterTitle>

      <form className="flex flex-1 flex-col" action={r.submitForm}>
        <div className="mt-6 flex gap-3">
          <div className="min-w-0 flex-1">
            <AppLabel htmlFor="app-first">{form("firstName")}</AppLabel>
            <FieldBox invalid={r.invalid.includes("firstName")}>
              <BoxInput id="app-first" name="firstName" autoComplete="given-name" defaultValue={r.values?.firstName} />
            </FieldBox>
            {r.fieldError("firstName") ? <FieldNote error>{r.fieldError("firstName")}</FieldNote> : null}
          </div>
          <div className="min-w-0 flex-1">
            <AppLabel htmlFor="app-last">{form("lastName")}</AppLabel>
            <FieldBox invalid={r.invalid.includes("lastName")}>
              <BoxInput id="app-last" name="lastName" autoComplete="family-name" placeholder={form("lastNamePlaceholder")} defaultValue={r.values?.lastName} />
            </FieldBox>
            {r.fieldError("lastName") ? <FieldNote error>{r.fieldError("lastName")}</FieldNote> : null}
          </div>
        </div>

        <div className="mt-[18px]">
          <AppLabel htmlFor="app-uni">{form("university")}</AppLabel>
          <UniversityPicker
            id="app-uni"
            look="app"
            universities={universities}
            defaultId={r.values?.universityId}
            defaultOther={r.values?.universityOther}
            invalid={r.invalid.includes("universityId")}
            otherInvalid={r.invalid.includes("universityOther")}
          />
          {r.fieldError("universityId") ?? r.fieldError("universityOther") ? (
            <FieldNote error>{r.fieldError("universityId") ?? r.fieldError("universityOther")}</FieldNote>
          ) : (
            <p className="mx-0.5 mt-2 mb-0 text-13 leading-[1.4] text-muted-2">
              {t.rich("universityNote", { b: (chunks: ReactNode) => <b className="text-blue">{chunks}</b> })}
            </p>
          )}
        </div>

        <div className="mt-[18px]">
          <AppLabel>{course("label")}</AppLabel>
          <input type="hidden" name="course" value={r.course} />
          <div className="flex gap-2" role="group" aria-label={course("label")}>
            {COURSES.map((c) => (
              <Choice key={c} shape={c === "MASTER" ? "wide" : "square"} selected={r.course === c} onClick={() => r.pickCourse(c)}>
                {course(c)}
              </Choice>
            ))}
          </div>
          {r.fieldError("course") ? <FieldNote error>{r.fieldError("course")}</FieldNote> : null}
        </div>

        {r.errorText ? <FieldNote error>{r.errorText}</FieldNote> : null}
        <div className="flex-1" />
        <button type="submit" disabled={r.pending} aria-busy={r.pending} className={cta}>
          {r.pending ? auth("sending") : form("submit")}
          <Icon name="arrowRight" size={22} strokeWidth={2.4} />
        </button>
      </form>
    </AppScreen>
  );
}
