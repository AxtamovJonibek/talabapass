"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CodeBoxes, PasswordBox } from "@/components/ui/app-code";
import {
  AppLabel,
  AppLead,
  AppLogo,
  AppScreen,
  AppTitle,
  BackArrow,
  BoxInput,
  FieldBox,
  FieldNote,
  FooterButton,
  FooterLink,
  IconTile,
  PhoneBox,
  textAction,
  TipCard,
  TopBar,
} from "@/components/ui/app-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { PREF, readPref, writePref } from "@/lib/app-prefs";
import { cn } from "@/lib/cn";
import { formatPhone, normalizePhone, phoneNational } from "@/lib/format";
import { useAuthFlow } from "@/components/auth/use-auth-flow";
import { SetPasswordScreen } from "./app-password";

const OTP_LENGTH = 6;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Ilova kirishi (design/app-flow uslubida): Auth / AuthBiznes / Auth2 — raqam yoki email + parol (SMSsiz).
 * Ro'yxat: telefon → Kod → Parol (→ ma'lumotlar formasi). "Parolni unutdim": raqam/email → Kod → Parol (tiklash).
 * Holat va action'lar sayt bilan bitta (`useAuthFlow`). Auth2 ("Qayta xush kelibsiz") — qurilmada oxirgi raqam bo'lsa,
 * maydon shu raqam bilan to'ldiriladi.
 */
export function AppLogin() {
  const t = useTranslations("app.login");
  const auth = useTranslations("auth");
  const common = useTranslations("app");
  const params = useSearchParams();
  const business = params.get("rol") === "biznes" || params.get("royxat") === "biznes";
  const flow = useAuthFlow({
    initialMode: params.get("royxat") ? "register" : "login",
    initialRole: business ? "business" : "student",
    leaveTo: business ? "/ilova/biznes?slayd=2" : "/ilova?slayd=4",
  });
  const { mode, step, failure, errorText, pending } = flow;
  const [lastPhone, setLastPhone] = useState<string | null | undefined>(undefined);
  const [switched, setSwitched] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    void readPref(PREF.lastPhone).then((value) => {
      if (!cancelled) setLastPhone(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (step === "password") {
    return (
      <SetPasswordScreen
        mode={flow.setMode}
        role={flow.role}
        onSubmit={flow.savePassword}
        onBack={flow.goBack}
        pending={pending}
        errorText={errorText}
        mismatch={failure?.error === "mismatch"}
      />
    );
  }

  if (step === "code") {
    const email = mode === "forgot" && flow.channel === "email";
    const target = mode === "register" ? flow.phone : flow.identifier.trim();
    return (
      <AppScreen>
        <TopBar>
          <BackArrow label={common("back")} onClick={flow.goBack} />
          <AppLogo />
        </TopBar>
        <form
          className="flex flex-1 flex-col"
          action={() => {
            if (flow.code.length === OTP_LENGTH) flow.verifyCode(flow.code);
          }}
        >
          <div className="mt-9">
            <IconTile icon="message" />
            <AppTitle size={42} className="mt-[22px]">
              {t("codeTitle")}
            </AppTitle>
            <AppLead className="mt-3.5">
              {email
                ? auth("codeSentToEmail", { email: target })
                : t.rich("codeLead", { phone: formatPhone(normalizePhone(target) ?? target), b: (chunks: ReactNode) => <b className="text-ink">{chunks}</b> })}
            </AppLead>
            {mode === "forgot" ? <FieldNote>{auth("resetSent")}</FieldNote> : null}
          </div>
          <div className="mt-[30px]">
            <CodeBoxes
              id="app-code"
              label={t("codeLabel")}
              value={flow.code}
              onChange={(next) => {
                flow.setCode(next);
                if (next.length === OTP_LENGTH && !pending) flow.verifyCode(next);
              }}
              invalid={failure?.error === "wrongCode"}
              disabled={pending}
              autoFocus
            />
            {errorText ? <FieldNote error>{errorText}</FieldNote> : null}
            <div className="mt-[18px] flex items-center justify-between">
              {flow.resendIn > 0 ? (
                <span className="text-15 font-medium text-muted-2">
                  {t("resendIn")} <b className="text-ink tabular-nums">{clock(flow.resendIn)}</b>
                </span>
              ) : (
                <button type="button" onClick={() => (mode === "register" ? flow.sendRegisterCode() : flow.sendResetCode())} disabled={pending} className={textAction}>
                  {t("resend")}
                </button>
              )}
              <button type="button" onClick={flow.goBack} className={textAction}>
                {t("changePhone")}
              </button>
            </div>
          </div>
          <div className="flex-1" />
          <div className="mt-6 mb-4">
            <TipCard icon="shield">{t.rich("tip", { b: (chunks: ReactNode) => <b className="font-extrabold text-blue">{chunks}</b> })}</TipCard>
          </div>
          <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", size: "app", strong: true, block: true })}>
            {pending ? t("checking") : t("confirm")}
            <Icon name="tick" size={22} strokeWidth={2.4} />
          </button>
        </form>
      </AppScreen>
    );
  }

  // Qurilma sozlamasi o'qilguncha (bir lahza) — bo'sh fon, aks holda Auth ↔ Auth2 almashib ko'rinadi
  if (lastPhone === undefined) return <div className="min-h-dvh bg-paper" />;

  const returning = mode === "login" && Boolean(lastPhone) && !switched && !business;

  if (mode !== "login") {
    const register = mode === "register";
    return (
      <AppScreen>
        <TopBar>
          <BackArrow label={common("back")} onClick={flow.goBack} />
          <AppLogo />
        </TopBar>
        <div className="mt-9">
          <IconTile icon={register ? "plus" : "lock"} />
          <AppTitle size={42} className="mt-[22px]">
            {register ? auth(`${flow.role}.registerTitle`) : auth("forgotTitle")}
          </AppTitle>
          <AppLead className="mt-3.5">{register ? auth("registerLead") : auth("forgotLead")}</AppLead>
        </div>
        {register ? (
          <form className="mt-8 flex flex-col" action={(form) => flow.sendRegisterCode(String(form.get("phone") ?? ""))}>
            <AppLabel htmlFor="app-phone">{t("phoneLabel")}</AppLabel>
            <PhoneBox id="app-phone" name="phone" placeholder={t("phonePlaceholder")} defaultValue={flow.phone ? phoneNational(flow.phone) : ""} invalid={failure?.error === "phone"} autoFocus />
            {errorText ? <FieldNote error>{errorText}</FieldNote> : null}
            <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-5")}>
              {pending ? t("sending") : t("sendCode")}
              <Icon name="arrowRight" size={22} strokeWidth={2.4} />
            </button>
          </form>
        ) : (
          <form className="mt-8 flex flex-col" action={(form) => flow.sendResetCode(String(form.get("identifier") ?? ""))}>
            <AppLabel htmlFor="app-forgot">{auth("identifierLabel")}</AppLabel>
            <FieldBox height={64} invalid={failure?.error === "identifier"} className="pr-[18px]">
              <BoxInput id="app-forgot" name="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={auth("identifierPlaceholder")} defaultValue={flow.identifier} text={18} autoFocus />
            </FieldBox>
            {errorText ? <FieldNote error>{errorText}</FieldNote> : null}
            <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-5")}>
              {pending ? t("sending") : auth("sendResetCode")}
              <Icon name="arrowRight" size={22} strokeWidth={2.4} />
            </button>
          </form>
        )}
        <div className="flex-1" />
        <FooterButton lead={auth(register ? "haveAccount" : "rememberPassword")} action={auth("signInAction")} onClick={() => flow.switchMode("login")} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <TopBar>
        {returning ? null : <BackArrow label={common("back")} onClick={flow.goBack} />}
        <AppLogo />
      </TopBar>

      <div className="relative mt-9">
        <div
          aria-hidden="true"
          className={cn("absolute -top-1.5 right-0 flex size-24 rotate-10 items-center justify-center rounded-full", returning ? "bg-green-bright" : "bg-orange")}
        >
          {returning ? (
            <Icon name="house" size={48} strokeWidth={2.4} />
          ) : (
            <span className="text-40 leading-none font-black font-stretch-62%">{t("badge")}</span>
          )}
        </div>
        {/* Sarlavha doiradan ustun: dizaynda (Auth2) doira "kelibsiz!" ni yopib qo'yardi */}
        <AppTitle size={returning ? 44 : 46} className="relative">{t.rich(returning ? "returningTitle" : "title", { br: () => <br /> })}</AppTitle>
        <AppLead className="mt-4 max-w-[300px]">{t(returning ? "returningLead" : business ? "businessLead" : "lead")}</AppLead>
      </div>

      <form
        className="mt-8 flex flex-col"
        action={(form) => {
          const identifier = String(form.get("identifier") ?? "");
          const phone = normalizePhone(identifier);
          // Auth2 uchun: oxirgi kirilgan raqam (email bilan kirilsa — o'zgarmaydi)
          if (phone) void writePref(PREF.lastPhone, phone);
          if (password) flow.login(identifier, password);
        }}
      >
        <AppLabel htmlFor="app-identifier">{auth("identifierLabel")}</AppLabel>
        <FieldBox height={64} invalid={failure?.error === "invalid" || failure?.error === "identifier"} className="pr-[18px]">
          <BoxInput
            key={returning ? "returning" : "new"}
            id="app-identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={auth("identifierPlaceholder")}
            defaultValue={flow.identifier || (returning && lastPhone ? phoneNational(lastPhone) : "")}
            text={18}
            autoFocus={!returning}
          />
        </FieldBox>
        <AppLabel htmlFor="app-password" className="mt-4">
          {t("passwordLabel")}
        </AppLabel>
        <PasswordBox
          id="app-password"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          height={64}
          invalid={failure?.error === "invalid"}
          autoFocus={returning}
          toggleLabels={{ show: t("showPassword"), hide: t("hidePassword") }}
        />
        {errorText ? <FieldNote error>{errorText}</FieldNote> : returning ? <FieldNote>{t("returningNote")}</FieldNote> : null}
        <button type="button" onClick={() => flow.switchMode("forgot")} className="mt-1.5 flex min-h-11 items-center self-start border-0 bg-transparent p-0 font-sans text-15 font-extrabold text-blue underline">
          {t("forgot")}
        </button>
        <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-3")}>
          {pending ? t("signingIn") : t("signIn")}
          <Icon name="arrowRight" size={22} strokeWidth={2.4} />
        </button>
      </form>

      <div className="flex-1" />

      <FooterButton lead={t("noAccount")} action={auth("registerAction")} onClick={() => flow.switchMode("register")} />
      {returning ? (
        <FooterButton lead={t("otherPhone")} action={t("otherPhoneAction")} onClick={() => setSwitched(true)} />
      ) : (
        <>
          {business ? (
            <FooterLink href="/kirish" replace lead={t("studentQuestion")} action={t("here")} />
          ) : (
            <FooterLink href="/ilova/biznes" lead={t("businessQuestion")} action={t("here")} />
          )}
          <p className="mx-1 mt-2 mb-0 text-center text-13 leading-[1.5] text-muted-2">
            {t.rich("consent", {
              terms: (chunks: ReactNode) => (
                <Link href="/huquqiy/shartlar" className="font-bold text-ink underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks: ReactNode) => (
                <Link href="/huquqiy/maxfiylik" className="font-bold text-ink underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </>
      )}
    </AppScreen>
  );
}
