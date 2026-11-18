"use client";

import { BackButton } from "@/components/ui/back-button";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { Field, Input, PhoneInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Segmented } from "@/components/ui/segmented";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { PasswordInput } from "@/components/ui/password-input";
import { normalizePhone, phoneNational } from "@/lib/format";
import { CodeEntry, OTP_LENGTH } from "./code-entry";
import { NewPasswordFields } from "./new-password-fields";
import { useAuthFlow } from "./use-auth-flow";

const textLink = "tp-link border-0 bg-transparent p-0 font-sans text-14 font-bold text-blue";


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

/**
 * W2 / W2m — kirish: raqam yoki email + parol (SMSsiz). Ro'yxat (telefon → SMS kod → parol) va "Parolni unutdim"
 * (raqam/email → kod → yangi parol) — shu ekranda, chap panel o'zgarmaydi. `?rol=biznes` — Biznes mavzusi,
 * `?royxat=talaba|biznes` — ro'yxat rejimida ochiladi (ma'lumotlar formasi parolsiz kelganni shu yerga qaytaradi).
 * Ikkala rol bir xil kiradi: rol tanlovi faqat mavzu va ro'yxat turi.
 */
export function LoginScreen() {
  const t = useTranslations("auth");
  const params = useSearchParams();
  const signup = params.get("royxat");
  const flow = useAuthFlow({
    initialMode: signup ? "register" : "login",
    initialRole: params.get("rol") === "biznes" || signup === "biznes" ? "business" : "student",
  });
  const { mode, step, role, failure, errorText, pending } = flow;
  const business = role === "business";
  const cta = business ? "orange" : "blue";
  const toggle = { show: t("showPassword"), hide: t("hidePassword") };

  return (
    <div className="@container flex min-h-screen flex-wrap bg-paper text-ink">
      <div
        className={cn(
          "relative box-border flex min-w-0 flex-[1_1_460px] flex-col gap-7 overflow-hidden p-[clamp(20px,4cqw,48px)]",
          business ? "bg-ink text-paper" : "bg-blue text-white",
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -top-[120px] -right-[120px] size-[460px] rounded-[180px] border-[50px] border-solid",
            business ? "border-ink-2" : "border-blue-2",
          )}
        />
        <Link href="/" className="relative self-start text-inherit no-underline">
          <Logo size={20} variant="white" tag={business ? "BIZNES" : undefined} />
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
      </div>

      <main className="box-border flex min-w-0 flex-[1_1_460px] items-center justify-center px-[clamp(16px,4cqw,48px)] py-[clamp(24px,5cqw,64px)]">
        <div className="flex w-full max-w-[440px] flex-col gap-5">
          <BackButton variant="text" onClick={flow.goBack} className="-mb-3 self-start" />
          <Segmented
            size="lg"
            label={t("roleLabel")}
            value={role}
            onChange={(next) => {
              flow.setRole(next);
              flow.setFailure(null);
            }}
            options={[
              { value: "student", label: <><Icon name="student" size={18} />{t("role.student")}</> },
              { value: "business", label: <><Icon name="store" size={18} />{t("role.business")}</> },
            ]}
          />

          <div>
            <h2 className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">
              {mode === "login" ? t(`${role}.title`) : mode === "register" ? t(`${role}.registerTitle`) : t("forgotTitle")}
            </h2>
            <p className="mt-1.5 mb-0 text-15 text-muted">
              {mode === "login" ? t(`${role}.subtitle`) : mode === "register" ? t("registerLead") : t("forgotLead")}
            </p>
          </div>

          {mode === "login" ? (
            <form
              className="flex flex-col gap-3.5"
              action={(form) => flow.login(String(form.get("identifier") ?? ""), String(form.get("password") ?? ""))}
            >
              <Field label={t("identifierLabel")} htmlFor="login-identifier">
                <Input
                  id="login-identifier"
                  name="identifier"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t("identifierPlaceholder")}
                  autoFocus
                  defaultValue={flow.identifier}
                  invalid={failure?.error === "invalid" || failure?.error === "identifier"}
                />
              </Field>
              <Field label={t("passwordLabel")} htmlFor="login-password" error={errorText}>
                <PasswordInput id="login-password" name="password" autoComplete="current-password" invalid={failure?.error === "invalid"} toggleLabels={toggle} />
              </Field>
              <button type="button" onClick={() => flow.switchMode("forgot")} className={cn(textLink, "-mt-1.5 self-start")}>
                {t("forgot")}
              </button>
              <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: cta, strong: true })}>
                {pending ? t("signingIn") : t("submit")}
              </button>
              {failure?.error === "invalid" ? <p className="m-0 text-13 leading-[1.5] text-muted">{t("noPasswordHint")}</p> : null}
            </form>
          ) : step === "form" ? (
            mode === "register" ? (
              <form className="flex flex-col gap-3.5" action={(form) => flow.sendRegisterCode(String(form.get("phone") ?? ""))}>
                <Field label={t("phoneLabel")} htmlFor="register-phone" error={errorText}>
                  <PhoneInput id="register-phone" name="phone" size="lg" autoFocus invalid={failure?.error === "phone"} defaultValue={flow.phone ? phoneNational(flow.phone) : ""} />
                </Field>
                <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: cta, strong: true })}>
                  {pending ? t("sending") : t("sendCode")}
                </button>
              </form>
            ) : (
              <form className="flex flex-col gap-3.5" action={(form) => flow.sendResetCode(String(form.get("identifier") ?? ""))}>
                <Field label={t("identifierLabel")} htmlFor="forgot-identifier" error={errorText}>
                  <Input
                    id="forgot-identifier"
                    name="identifier"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={t("identifierPlaceholder")}
                    autoFocus
                    defaultValue={flow.identifier}
                    invalid={failure?.error === "identifier"}
                  />
                </Field>
                <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: cta, strong: true })}>
                  {pending ? t("sending") : t("sendResetCode")}
                </button>
              </form>
            )
          ) : step === "code" ? (
            <form
              className="flex flex-col gap-3.5"
              action={() => {
                if (flow.code.length === OTP_LENGTH) flow.verifyCode(flow.code);
              }}
            >
              {mode === "forgot" ? <p className="m-0 text-14 text-muted">{t("resetSent")}</p> : null}
              <CodeEntry
                phone={mode === "register" ? flow.phone : (normalizePhone(flow.identifier) ?? "")}
                label={mode === "forgot" && flow.channel === "email" ? t("codeSentToEmail", { email: flow.identifier.trim() }) : undefined}
                code={flow.code}
                onCode={flow.setCode}
                onComplete={flow.verifyCode}
                onResend={() => (mode === "register" ? flow.sendRegisterCode() : flow.sendResetCode())}
                onChangePhone={flow.goBack}
                resendIn={flow.resendIn}
                pending={pending}
                invalid={failure?.error === "wrongCode"}
                errorText={errorText}
              />
              <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: cta, strong: true })}>
                {pending ? t("checking") : t("confirmCode")}
              </button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-3.5"
              action={(form) => flow.savePassword(String(form.get("password") ?? ""), String(form.get("confirm") ?? ""))}
            >
              <div>
                <h3 className="m-0 text-20 font-extrabold">{t(`setPassword.${flow.setMode}Title`)}</h3>
                <p className="mt-1 mb-0 text-14 text-muted">{t(`setPassword.${flow.setMode}Lead`)}</p>
              </div>
              <NewPasswordFields idPrefix="set" errorText={errorText} mismatch={failure?.error === "mismatch"} />
              <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: cta, strong: true })}>
                {pending ? t("setPassword.saving") : t(flow.setMode === "new" ? "setPassword.continue" : "setPassword.save")}
              </button>
            </form>
          )}

          <div className="flex items-center gap-3 text-13 text-muted">
            <span className="h-px flex-1 bg-line" />
            {t("or")}
            <span className="h-px flex-1 bg-line" />
          </div>

          {mode === "login" ? (
            <button
              type="button"
              onClick={() => flow.switchMode("register")}
              className="tp-card box-content flex min-h-16 items-center gap-3.5 rounded-14 border-[1.5px] border-dashed border-placeholder bg-white px-4 py-2.5 text-left font-sans text-ink"
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-10", business ? "bg-orange text-ink" : "bg-blue text-white")}>
                <Icon name="plus" size={18} strokeWidth={2.4} />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <b className="text-15">{t(`${role}.registerTitle`)}</b>
                <span className="text-13 text-muted">{t(`${role}.registerSubtitle`)}</span>
              </span>
              <Icon name="chevronRight" size={18} strokeWidth={2.2} />
            </button>
          ) : (
            <p className="m-0 text-14 text-muted">
              {t(mode === "register" ? "haveAccount" : "rememberPassword")}{" "}
              <button type="button" onClick={() => flow.switchMode("login")} className={textLink}>
                {t("signInAction")}
              </button>
            </p>
          )}

          {business ? <p className="m-0 text-14 text-muted">{t("business.cashierNote")}</p> : null}

          <p className="m-0 text-13 leading-[1.5] text-muted">
            {t.rich("consent", {
              terms: (chunks) => <Link href="/huquqiy/shartlar" className="tp-link font-bold text-ink underline">{chunks}</Link>,
              privacy: (chunks) => <Link href="/huquqiy/maxfiylik" className="tp-link font-bold text-ink underline">{chunks}</Link>,
            })}
          </p>
        </div>
      </main>
    </div>
  );
}
