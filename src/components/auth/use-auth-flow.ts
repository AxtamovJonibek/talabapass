"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { normalizePhone } from "@/lib/format";
import { useStepHistory } from "@/lib/use-step-history";
import {
  forgotRequestAction,
  forgotVerifyAction,
  loginAction,
  registerVerifyAction,
  requestCodeAction,
  setPasswordAction,
  type AuthError,
  type AuthFailure,
} from "@/server/actions/auth";

export const RESEND_SECONDS = 60;

export type AuthMode = "login" | "register" | "forgot";
export type AuthStep = "form" | "code" | "password";
export type Role = "student" | "business";
/** Parol qadami: yangi raqam, parolsiz eski hisob yoki "Parolni unutdim" */
export type SetMode = "new" | "missing" | "reset";

type Failure = Pick<AuthFailure, "error" | "retryInSeconds" | "left">;

/**
 * Kirish oqimining holati — sayt (W2, `LoginScreen`) va Capacitor ilova (`AppLogin`) bitta hook'dan, ko'rinish alohida.
 * Kirish: raqam/email + parol. Ro'yxat: telefon → SMS kod → parol (→ ma'lumotlar formasi). Parolni unutdim: raqam/email →
 * kod (SMS yoki email) → yangi parol. Qadamlar brauzer tarixiga yoziladi (telefondagi "orqaga" oldingi qadamga).
 */
export function useAuthFlow({ initialMode = "login", initialRole = "student", leaveTo = "/" }: { initialMode?: AuthMode; initialRole?: Role; leaveTo?: string } = {}) {
  const t = useTranslations("auth");
  // Mavzu va ro'yxat turi (ko'rinish boshqaradi)
  const [role, setRole] = useState<Role>(initialRole);
  const [mode, setModeState] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<AuthStep>("form");
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [setMode, setSetMode] = useState<SetMode>("new");
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const depth = (mode === initialMode ? 0 : 1) + (step === "form" ? 0 : step === "code" ? 1 : 2);
  const goBack = useStepHistory(
    depth,
    () => {
      setFailure(null);
      if (step === "form") setModeState(initialMode);
      // Ishlatilgan kodga qaytilmaydi — parol qadamidan formaga
      else setStep("form");
    },
    leaveTo,
  );

  function switchMode(next: AuthMode) {
    setModeState(next);
    setStep("form");
    setCode("");
    setFailure(null);
  }

  const fail = (result: Failure) => setFailure({ error: result.error, retryInSeconds: result.retryInSeconds, left: result.left });

  function login(rawIdentifier: string, password: string) {
    setFailure(null);
    setIdentifier(rawIdentifier);
    startTransition(async () => {
      // Muvaffaqiyatda server yo'naltiradi; bu yerga faqat xato qaytadi
      const result = await loginAction(rawIdentifier, password);
      if (result) fail(result);
    });
  }

  function sendRegisterCode(rawPhone: string = phone) {
    setFailure(null);
    startTransition(async () => {
      const result = await requestCodeAction(rawPhone);
      if (!result.ok) {
        fail(result);
        // Kod hozirgina yuborilgan — foydalanuvchida u bor, kiritish qadamiga o'tamiz
        if (result.error !== "tooSoon" || step === "code") return;
        setResendIn(result.retryInSeconds ?? RESEND_SECONDS);
        setPhone(normalizePhone(rawPhone) ?? rawPhone);
      } else {
        setResendIn(RESEND_SECONDS);
        setPhone(result.phone);
      }
      setCode("");
      setStep("code");
    });
  }

  function sendResetCode(rawIdentifier: string = identifier) {
    setFailure(null);
    setIdentifier(rawIdentifier);
    startTransition(async () => {
      const result = await forgotRequestAction(rawIdentifier);
      if (!result.ok) return fail(result);
      setChannel(result.channel);
      setResendIn(RESEND_SECONDS);
      setCode("");
      setStep("code");
    });
  }

  function verifyCode(value: string) {
    setFailure(null);
    startTransition(async () => {
      if (mode === "register") {
        const result = await registerVerifyAction(phone, value, role);
        if (!result.ok) {
          setCode("");
          return fail(result);
        }
        setSetMode(result.mode);
      } else {
        const result = await forgotVerifyAction(identifier, value);
        if (!result.ok) {
          setCode("");
          return fail(result);
        }
        setSetMode("reset");
      }
      setStep("password");
    });
  }

  function savePassword(password: string, confirm: string) {
    setFailure(null);
    startTransition(async () => {
      const result = await setPasswordAction(password, confirm);
      if (!result) return;
      fail(result);
      // Tasdiqlash eskirgan — koddan qaytadan
      if (result.error === "stepExpired") setStep("form");
    });
  }

  const errorText = failure
    ? t(`errors.${failure.error as AuthError}`, {
        seconds: failure.retryInSeconds ?? 0,
        minutes: Math.max(1, Math.ceil((failure.retryInSeconds ?? 0) / 60)),
        left: failure.left ?? 0,
      })
    : null;

  return {
    mode,
    step,
    role,
    setRole,
    identifier,
    phone,
    channel,
    setMode,
    code,
    setCode,
    failure,
    setFailure,
    errorText,
    resendIn,
    pending,
    goBack,
    switchMode,
    login,
    sendRegisterCode,
    sendResetCode,
    verifyCode,
    savePassword,
  };
}

export type AuthFlow = ReturnType<typeof useAuthFlow>;
