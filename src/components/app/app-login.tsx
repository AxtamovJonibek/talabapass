"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CodeBoxes } from "@/components/ui/app-code";
import {
  AppLabel,
  AppLead,
  AppLogo,
  AppScreen,
  AppTitle,
  BackArrow,
  FieldNote,
  FooterButton,
  FooterLink,
  IconTile,
  PhoneBox,
  textAction,
  TopBar,
} from "@/components/ui/app-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { PREF, readPref, writePref } from "@/lib/app-prefs";
import { cn } from "@/lib/cn";
import { formatPhone, phoneNational } from "@/lib/format";
import { useStepHistory } from "@/lib/use-step-history";
import { requestCodeAction, verifyCodeAction, type AuthError } from "@/server/actions/auth";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

type Variant = "student" | "business" | "returning";
type Failure = { error: AuthError; retryInSeconds?: number };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Ilova kirishi (design/app-flow: Auth, AuthBiznes, Auth2 → Kod). Telefon → SMS kod.
 * Auth2 ("Qayta xush kelibsiz") — qurilmada oxirgi kirilgan raqam bo'lsa (chiqib ketgandan keyin).
 * Raqam ro'yxatda bor-yo'qligi kod tasdiqlanmaguncha oshkor qilinmaydi.
 */
export function AppLogin() {
  const t = useTranslations("app.login");
  const common = useTranslations("app");
  const auth = useTranslations("auth");
  const business = useSearchParams().get("rol") === "biznes";
  const [lastPhone, setLastPhone] = useState<string | null | undefined>(undefined);
  const [switched, setSwitched] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [pending, startTransition] = useTransition();

  const variant: Variant = business ? "business" : lastPhone && !switched ? "returning" : "student";

  useEffect(() => {
    let cancelled = false;
    void readPref(PREF.lastPhone).then((value) => {
      if (cancelled) return;
      setLastPhone(value);
      if (value) setPhoneInput(phoneNational(value));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const goBack = useStepHistory(
    step === "code" ? 1 : 0,
    () => {
      setStep("phone");
      setFailure(null);
    },
    business ? "/ilova/biznes?slayd=2" : "/ilova?slayd=4",
  );

  function sendCode(rawPhone: string = phoneInput) {
    setFailure(null);
    setPhoneInput(rawPhone);
    startTransition(async () => {
      const result = await requestCodeAction(rawPhone);
      if (!result.ok) {
        setFailure(result);
        // Kod yaqinda yuborilgan — foydalanuvchida u bor, kiritish qadamiga o'tamiz
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
      // Muvaffaqiyatda server yo'naltiradi; bu yerga faqat xato qaytadi
      const result = await verifyCodeAction(phoneInput, value, business ? "business" : "student");
      if (result) {
        setFailure(result);
        setCode("");
      } else if (phone) {
        await writePref(PREF.lastPhone, phone);
      }
    });
  }

  const errorText = failure
    ? auth(`errors.${failure.error}`, { seconds: failure.retryInSeconds ?? 0, minutes: Math.ceil((failure.retryInSeconds ?? 0) / 60) })
    : null;

  // Qurilma sozlamasi o'qilguncha (bir lahza) — bo'sh fon, aks holda Auth ↔ Auth2 almashib ko'rinadi
  if (lastPhone === undefined) return <div className="min-h-dvh bg-paper" />;

  if (step === "code") {
    return (
      <AppScreen>
        <TopBar>
          <BackArrow label={common("back")} onClick={goBack} />
          <AppLogo />
        </TopBar>
        <form
          className="flex flex-1 flex-col"
          action={() => {
            if (code.length === OTP_LENGTH) verify(code);
          }}
        >
          <div className="mt-9">
            <IconTile icon="message" />
            <AppTitle size={42} className="mt-[22px]">
              {t("codeTitle")}
            </AppTitle>
            <AppLead className="mt-3.5">
              {t.rich("codeLead", { phone: formatPhone(phone), b: (chunks: ReactNode) => <b className="text-ink">{chunks}</b> })}
            </AppLead>
          </div>
          <div className="mt-[30px]">
            <CodeBoxes
              id="app-code"
              label={t("codeLabel")}
              value={code}
              onChange={(next) => {
                setCode(next);
                if (next.length === OTP_LENGTH && !pending) verify(next);
              }}
              invalid={failure?.error === "wrongCode"}
              disabled={pending}
              autoFocus
            />
            {errorText ? <FieldNote error>{errorText}</FieldNote> : null}
            <div className="mt-[18px] flex items-center justify-between">
              {resendIn > 0 ? (
                <span className="text-15 font-medium text-muted-2">
                  {t("resendIn")} <b className="text-ink tabular-nums">{clock(resendIn)}</b>
                </span>
              ) : (
                <button type="button" onClick={() => sendCode()} disabled={pending} className={textAction}>
                  {t("resend")}
                </button>
              )}
              <button type="button" onClick={goBack} className={textAction}>
                {t("changePhone")}
              </button>
            </div>
          </div>
          <div className="flex-1" />
          <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-6")}>
            {pending ? t("checking") : t("confirm")}
            <Icon name="tick" size={22} strokeWidth={2.4} />
          </button>
        </form>
      </AppScreen>
    );
  }

  const returning = variant === "returning";

  return (
    <AppScreen>
      <TopBar>
        {returning ? null : <BackArrow label={common("back")} onClick={goBack} />}
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

      <form className="mt-8 flex flex-col" action={(form) => sendCode(String(form.get("phone") ?? ""))}>
        <AppLabel htmlFor="app-phone">{t("phoneLabel")}</AppLabel>
        <PhoneBox
          key={variant}
          id="app-phone"
          name="phone"
          placeholder={t("phonePlaceholder")}
          defaultValue={phoneInput}
          invalid={failure?.error === "phone"}
          autoFocus={!returning}
        />
        {errorText ? <FieldNote error>{errorText}</FieldNote> : returning ? <FieldNote>{t("returningNote")}</FieldNote> : null}
        <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-5")}>
          {pending ? t("sending") : t("sendCode")}
          <Icon name="arrowRight" size={22} strokeWidth={2.4} />
        </button>
      </form>

      <div className="flex-1" />

      {returning ? (
        <FooterButton
          lead={t("otherPhone")}
          action={t("otherPhoneAction")}
          onClick={() => {
            setSwitched(true);
            setPhoneInput("");
            setFailure(null);
          }}
        />
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
