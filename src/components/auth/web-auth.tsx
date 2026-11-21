"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { OtpInput } from "@/components/ui/otp-input";
import { BackButton } from "@/components/ui/back-button";
import { buttonClass } from "@/components/ui/button";
import { Field, Input, PhoneInput } from "@/components/ui/field";
import { ToggleSquare } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Segmented } from "@/components/ui/segmented";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatPhone, normalizePhone, phoneNational } from "@/lib/format";
import { isValidPassword, cleanPassword } from "@/lib/password";
import { appleSignIn } from "@/lib/social-web";
import type { UniversityOption } from "@/lib/universities";
import { useStepHistory } from "@/lib/use-step-history";
import { LANG_LABEL, WEB_AUTH_COPY, WEB_LANGS, type WebAuthCopy, type WebLang } from "@/lib/web-auth-copy";
import {
  webLoginTicketAction,
  webRegisterBusinessAction,
  webRegisterStudentAction,
  webRequestCodeAction,
  webSetPasswordAction,
  webSignInAction,
  webSocialAction,
  webSubmitBusinessAction,
  webVerifyCodeAction,
  type SocialNext,
  type WebFailure,
} from "@/server/actions/web-auth";
import { GoogleButton, PasswordInput, PasswordRules, UniversitySelect } from "./web-auth-parts";

/*
 * Sayt kirishi va ro'yxati (talaba, biznes) — ilovadagi oqim bilan bir xil: ro'yxat usuli (Telefon / Google / Apple) →
 * telefon: SMS kod → parol → ma'lumotlar; Google/Apple: akkaunt → parol → ma'lumotlar. Kirish — telefon yoki email + parol
 * (SMSsiz) yoki Google/Apple tanlab parol. "Parolni unutdim": telefon → SMS kod → yangi parol. Qoidalar serverda
 * (`api/auth-flow.ts`), bu yerda faqat ko'rinish va qadamlar.
 */

type Role = "student" | "business";
type View = "signin" | "methods" | "phone" | "code" | "password" | "details" | "done";
type PasswordMode = "login" | "set" | "reset";
type Social = { googleClientId: string | null; appleClientId: string | null; appleRedirect: string };

export type WebAuthProps = {
  start: "signin" | "register";
  role: Role;
  universities: UniversityOption[];
  social: Social;
};

const LANG_KEY = "tp:til";
const RESEND_SECONDS = 60;
const OTP_LENGTH = 6;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const langListeners = new Set<() => void>();
let langMemory: WebLang = "uz";
const subscribeLang = (listener: () => void) => {
  langListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    langListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};
function readLang(): WebLang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "uz" || saved === "ru" || saved === "en") return saved;
  } catch {
    // localStorage yo'q — shu sahifadagi tanlov
  }
  return langMemory;
}
function writeLang(next: WebLang) {
  langMemory = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // saqlanmadi — shu sahifada ishlaydi
  }
  langListeners.forEach((listener) => listener());
}

const useLang = (): [WebLang, (lang: WebLang) => void] => [useSyncExternalStore(subscribeLang, readLang, () => "uz" as const), writeLang];

function errorOf(c: WebAuthCopy["errors"], f: WebFailure): string {
  const minutes = Math.max(1, Math.ceil((f.retryInSeconds ?? 0) / 60));
  switch (f.code) {
    case "too_soon":
      return c.too_soon(f.retryInSeconds ?? RESEND_SECONDS);
    case "code_locked":
      return c.code_locked(minutes);
    case "password_locked":
      return c.password_locked(minutes);
    case "wrong_password":
      return c.wrong_password(f.left);
    case "invalid_phone":
    case "daily_limit":
    case "ip_limit":
    case "sms_failed":
    case "wrong_code":
    case "code_expired":
    case "account_blocked":
    case "no_business":
    case "step_expired":
    case "weak_password":
    case "password_mismatch":
    case "tin_taken":
    case "invalid_request":
    case "social_invalid":
    case "social_unavailable":
    case "social_unreachable":
      return c[f.code];
    case "rate_limited":
      return c.rate_limited;
    default:
      return c.unknown;
  }
}

/** Telefon (9 raqam) bo'lsa +998…, aks holda email — serverga shunday ketadi. */
function identifierOf(raw: string): string {
  const v = raw.trim();
  if (v.includes("@")) return v;
  const digits = v.replace(/\D/g, "").replace(/^998(?=\d{9}$)/, "");
  return digits.length === 9 ? `+998${digits}` : v;
}

export function WebAuth({ start, role: initialRole, universities, social }: WebAuthProps) {
  const [lang, setLang] = useLang();
  const c = WEB_AUTH_COPY[lang];
  const [role, setRole] = useState<Role>(initialRole);
  const [trail, setTrail] = useState<View[]>([start === "signin" ? "signin" : "methods"]);
  const view = trail[trail.length - 1];
  const [purpose, setPurpose] = useState<"register" | "reset">("register");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [ticket, setTicket] = useState("");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("set");
  /** Google/Apple akkaunti: "Parolni unutdim" yo'q (SMS raqami yo'q), parol qatorida email ko'rsatiladi */
  const [socialAccount, setSocialAccount] = useState<string | null>(null);
  const [registrationTicket, setRegistrationTicket] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const business = role === "business";
  const cta = business ? "orange" : "blue";
  const submitClass = buttonClass({ variant: cta, strong: true, block: true });

  const goBack = useStepHistory(trail.length - 1, () => {
    setError(null);
    setInvalid([]);
    setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));
  });

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function go(next: View, { replace = false, reset = false } = {}) {
    setError(null);
    setInvalid([]);
    setTrail((t) => (reset ? [next] : replace ? [...t.slice(0, -1), next] : [...t, next]));
  }

  /** Xato natijasi: matn; qadam tokeni eskirgan bo'lsa — telefon qadamiga */
  function fail(result: WebFailure) {
    if (result.fields) setInvalid(result.fields);
    setError(errorOf(c.errors, result));
    if (result.code === "step_expired") setTrail((t) => (t.includes("phone") ? t.slice(0, t.indexOf("phone") + 1) : ["phone"]));
  }

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [universityOther, setUniversityOther] = useState("");
  const [course, setCourse] = useState("");
  const [bizName, setBizName] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizTin, setBizTin] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizTelegram, setBizTelegram] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [registered, setRegistered] = useState(false);

  // ───────── telefon / kod ─────────

  function sendCode(rawPhone: string = phoneInput) {
    setError(null);
    setPhoneInput(rawPhone);
    startTransition(async () => {
      const result = await webRequestCodeAction(rawPhone);
      if (!result.ok) {
        fail(result);
        // Kod yaqinda yuborilgan — foydalanuvchida u bor, kiritish qadamiga o'tamiz (xabar qoladi)
        if (result.code !== "too_soon" || view === "code") return;
        setResendIn(result.retryInSeconds ?? RESEND_SECONDS);
        setPhone(normalizePhone(rawPhone) ?? "");
        setCode("");
        go("code");
        return setError(errorOf(c.errors, result));
      }
      setResendIn(result.resendInSeconds);
      setPhone(result.phone);
      setCode("");
      if (view !== "code") go("code");
    });
  }

  function verify(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await webVerifyCodeAction(phoneInput, value, role);
      if (!result.ok) {
        setCode("");
        return fail(result);
      }
      const next = result.result;
      if (next.role === "cashier") return setError(c.errors.unknown);
      if (purpose === "reset" && next.next === "setPassword" && next.isNew) {
        setCode("");
        return setError(c.errors.noAccount);
      }
      setTicket(next.ticket);
      setSocialAccount(null);
      setPasswordMode(next.next === "password" ? (purpose === "reset" ? "reset" : "login") : purpose === "reset" ? "reset" : "set");
      go("password", { replace: true });
    });
  }

  // ───────── parol ─────────

  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function clearPassword() {
    setPassword("");
    setRepeat("");
    setSubmitted(false);
  }

  function submitPassword() {
    setError(null);
    if (passwordMode !== "login") {
      setSubmitted(true);
      if (!isValidPassword(password)) return;
      if (cleanPassword(password) !== cleanPassword(repeat)) return setError(c.errors.password_mismatch);
    }
    startTransition(async () => {
      // Kirish / tiklash muvaffaqiyatli bo'lsa server yo'naltiradi — bu yerga faqat xato qaytadi
      if (passwordMode === "login") {
        const result = await webLoginTicketAction(ticket, password);
        if (result) fail(result);
        return;
      }
      const result = await webSetPasswordAction(ticket, password, repeat);
      if (!result) return;
      if (!result.ok) return fail(result);
      setRegistrationTicket(result.registrationTicket);
      if (phone) setBizPhone(phoneNational(phone));
      go("details");
    });
  }

  function forgot() {
    // Telefon qadami tokeni bilan: yangi parol (boshqa qurilmalar chiqariladi)
    setPurpose("reset");
    clearPassword();
    setPasswordMode("reset");
    setError(null);
  }

  function startReset() {
    setPurpose("reset");
    setPhoneInput("");
    go("phone");
  }

  function startRegister(withPhone: boolean) {
    setPurpose("register");
    if (withPhone) go("phone");
  }

  // ───────── Google / Apple ─────────

  function onSocial(provider: "GOOGLE" | "APPLE", idToken: string, names?: { firstName?: string; lastName?: string }) {
    setError(null);
    startTransition(async () => {
      const result = await webSocialAction(provider, idToken, role, names?.firstName, names?.lastName);
      if (result === undefined) return;
      if (!result.ok) return fail(result);
      const next: SocialNext = result.result;
      clearPassword();
      setPurpose("register");
      if (next.next === "password") {
        setTicket(next.ticket);
        setSocialAccount(next.masked);
        setPasswordMode("login");
        return go("password");
      }
      setRole(next.role);
      setTicket(next.registrationTicket);
      setSocialAccount(next.profile.email ?? "");
      // Google/Apple ismi oldindan to'ladi (foydalanuvchi o'zgartirishi mumkin)
      setFirstName(next.profile.firstName ?? "");
      setLastName(next.profile.lastName ?? "");
      setPasswordMode("set");
      go("password");
    });
  }

  async function apple() {
    if (!social.appleClientId) return setError(c.errors.appleFailed);
    setError(null);
    try {
      const result = await appleSignIn(social.appleClientId, social.appleRedirect);
      if (result) onSocial("APPLE", result.idToken, result);
    } catch {
      setError(c.errors.appleFailed);
    }
  }

  const socialButtons = (
    <div className="flex flex-col items-stretch gap-2.5">
      <GoogleButton clientId={social.googleClientId} onToken={(token) => onSocial("GOOGLE", token)} onFail={() => setError(c.errors.googleFailed)} />
      {social.googleClientId ? null : (
        <button type="button" onClick={() => setError(c.errors.googleFailed)} className="tap flex h-10 w-full items-center justify-center rounded-4 border-hair border-solid border-line bg-white p-0 font-sans text-14 font-bold text-ink">
          {c.methods.google}
        </button>
      )}
      <button
        type="button"
        onClick={() => void apple()}
        disabled={pending}
        className="tap flex h-10 w-full items-center justify-center gap-2 rounded-4 border-0 bg-ink p-0 font-sans text-14 font-bold text-white"
      >
        <Image src="/brands/apple-logo-button.png" alt="" width={28} height={28} unoptimized />
        {c.methods.apple}
      </button>
    </div>
  );

  const divider = (
    <div className="flex items-center gap-3 text-13 text-muted">
      <span className="h-px flex-1 bg-line" />
      {c.or}
      <span className="h-px flex-1 bg-line" />
    </div>
  );

  const errorLine = error ? (
    <p role="alert" className="m-0 text-13 font-semibold text-danger">
      {error}
    </p>
  ) : null;

  // ───────── ma'lumotlar (talaba / biznes) ─────────


  function submitStudent() {
    setError(null);
    setInvalid([]);
    startTransition(async () => {
      const result = await webRegisterStudentAction({ registrationTicket, firstName, lastName, universityId, universityOther, course });
      if (result) fail(result);
    });
  }

  function submitBusiness() {
    setError(null);
    setInvalid([]);
    startTransition(async () => {
      if (!registered) {
        const created = await webRegisterBusinessAction(registrationTicket, { name: bizName, address: bizAddress, tin: bizTin, phone: bizPhone ? `+998${bizPhone.replace(/\D/g, "")}` : "", telegram: bizTelegram });
        if (!created.ok) return fail(created);
        setRegistered(true);
      }
      if (photo) {
        const uploaded = await fetch("/api/biznes/hujjat?tur=logo", { method: "POST", headers: { "x-file-name": encodeURIComponent(photo.name) }, body: photo }).catch(() => null);
        if (!uploaded?.ok) {
          setPhoto(null);
          return setError(c.errors.upload);
        }
      }
      const submittedResult = await webSubmitBusinessAction();
      if (!submittedResult.ok) return fail(submittedResult);
      go("done", { reset: true });
    });
  }

  const fieldError = (name: string, text: string) => (invalid.includes(name) ? text : undefined);

  // ───────── ko'rinish ─────────

  let body: ReactNode;
  if (view === "signin") {
    body = (
      <SignInForm
        c={c}
        cta={submitClass}
        pending={pending}
        errorLine={errorLine}
        invalid={Boolean(error)}
        onSubmit={(identifier, pw) =>
          startTransition(async () => {
            setError(null);
            const result = await webSignInAction(identifierOf(identifier), pw);
            if (result) fail(result);
          })
        }
        onForgot={startReset}
        footer={
          <>
            {divider}
            {socialButtons}
            <p className="m-0 text-center text-14 text-muted">
              {c.signin.noAccount}{" "}
              <button
                type="button"
                onClick={() => {
                  setPurpose("register");
                  go("methods");
                }}
                className="tp-link border-0 bg-transparent p-0 font-sans text-14 font-bold text-ink underline"
              >
                {c.signin.register}
              </button>
            </p>
          </>
        }
      />
    );
  } else if (view === "methods") {
    body = (
      <div className="flex flex-col gap-3.5">
        <Heading>{c.methods.title}</Heading>
        {socialButtons}
        {divider}
        <button type="button" onClick={() => startRegister(true)} className={buttonClass({ variant: cta, strong: true, block: true })}>
          {c.methods.phone}
        </button>
        {errorLine}
        <p className="m-0 text-center text-14 text-muted">
          {c.methods.haveAccount}{" "}
          <button type="button" onClick={() => go("signin", { reset: true })} className="tp-link border-0 bg-transparent p-0 font-sans text-14 font-bold text-ink underline">
            {c.methods.signIn}
          </button>
        </p>
      </div>
    );
  } else if (view === "phone") {
    body = (
      <form
        className="flex flex-col gap-3.5"
        action={(form) => {
          sendCode(String(form.get("phone") ?? ""));
        }}
      >
        <Heading>{purpose === "reset" ? c.phone.resetTitle : c.phone.registerTitle}</Heading>
        {purpose === "reset" ? <p className="m-0 text-15 text-muted">{c.phone.resetLead}</p> : null}
        <Field label={c.phone.label} htmlFor="login-phone" error={error}>
          <PhoneInput id="login-phone" name="phone" size="lg" autoFocus invalid={Boolean(error)} defaultValue={phoneInput} />
        </Field>
        <button type="submit" disabled={pending} aria-busy={pending} className={submitClass}>
          {pending ? c.phone.sending : c.phone.send}
        </button>
      </form>
    );
  } else if (view === "code") {
    body = (
      <form
        className="flex flex-col gap-3.5"
        action={() => {
          if (code.length === OTP_LENGTH) verify(code);
        }}
      >
        <Heading>{c.code.title}</Heading>
        <p className="m-0 text-15 text-muted">{c.code.lead(formatPhone(phone))}</p>
        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (next.length === OTP_LENGTH && !pending) verify(next);
          }}
          digitLabel={c.code.digit}
          invalid={Boolean(error)}
          disabled={pending}
          autoFocus
        />
        {errorLine}
        <div className="flex items-center justify-between text-13">
          {resendIn > 0 ? (
            <span className="text-muted">
              {c.code.resendIn} <b className="text-ink tabular-nums">{clock(resendIn)}</b>
            </span>
          ) : (
            <button type="button" onClick={() => sendCode()} disabled={pending} className="tp-link border-0 bg-transparent p-0 font-sans text-13 font-bold text-ink underline">
              {c.code.resend}
            </button>
          )}
          <button type="button" onClick={goBack} className="tp-link border-0 bg-transparent p-0 font-sans text-13 font-bold text-ink underline">
            {c.code.change}
          </button>
        </div>
        <button type="submit" disabled={pending} aria-busy={pending} className={submitClass}>
          {pending ? c.code.checking : c.code.confirm}
        </button>
      </form>
    );
  } else if (view === "password") {
    const p = c.password;
    const login = passwordMode === "login";
    const title = login ? p.loginTitle : passwordMode === "reset" ? p.resetTitle : p.setTitle;
    body = (
      <form
        className="flex flex-col gap-3.5"
        action={() => submitPassword()}
      >
        <Heading>{title}</Heading>
        <p className="m-0 text-15 text-muted">
          {login ? (socialAccount ? socialAccount : p.found) : passwordMode === "reset" ? p.resetLead : (socialAccount ?? p.setLead)}
        </p>
        <Field label={p.label} htmlFor="auth-password" error={login ? error : undefined}>
          <PasswordInput id="auth-password" value={password} onChange={setPassword} autoComplete={login ? "current-password" : "new-password"} invalid={login && Boolean(error)} autoFocus copy={p} />
        </Field>
        {login ? null : (
          <>
            <Field label={p.repeat} htmlFor="auth-repeat">
              <PasswordInput id="auth-repeat" value={repeat} onChange={setRepeat} autoComplete="new-password" copy={p} />
            </Field>
            <PasswordRules value={password} submitted={submitted} copy={p} />
            {errorLine}
          </>
        )}
        <button type="submit" disabled={pending || (login && !password)} aria-busy={pending} className={submitClass}>
          {login ? (pending ? p.signingIn : p.signIn) : pending ? p.saving : p.save}
        </button>
        {login && !socialAccount ? (
          <div className="flex items-center justify-between text-13">
            <button type="button" onClick={forgot} className="tp-link border-0 bg-transparent p-0 font-sans text-13 font-bold text-ink underline">
              {p.forgot}
            </button>
            <button type="button" onClick={() => {
                clearPassword();
                setPurpose("register");
                setPhoneInput("");
                setError(null);
                setTrail(["methods", "phone"]);
              }} className="tp-link border-0 bg-transparent p-0 font-sans text-13 font-bold text-ink underline">
              {p.otherNumber}
            </button>
          </div>
        ) : null}
      </form>
    );
  } else if (view === "details" && role === "student") {
    const s = c.studentForm;
    body = (
      <form className="flex flex-col gap-3.5" action={() => submitStudent()}>
        <Heading>{s.title}</Heading>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={s.firstName} htmlFor="reg-first" error={fieldError("firstName", s.fieldError)}>
            <Input id="reg-first" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} invalid={invalid.includes("firstName")} />
          </Field>
          <Field label={s.lastName} htmlFor="reg-last" error={fieldError("lastName", s.fieldError)}>
            <Input id="reg-last" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} invalid={invalid.includes("lastName")} />
          </Field>
        </div>
        <Field label={s.university} htmlFor="reg-uni" error={fieldError("universityId", s.fieldError) ?? fieldError("universityOther", s.fieldError)}>
          <UniversitySelect
            id="reg-uni"
            universities={universities}
            copy={s}
            value={universityId}
            other={universityOther}
            onChange={(id, other) => {
              setUniversityId(id);
              setUniversityOther(other);
            }}
            invalid={invalid.includes("universityId")}
            otherInvalid={invalid.includes("universityOther")}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-13 font-semibold">{s.course}</span>
          <div className="grid grid-cols-5 gap-1.5">
            {s.courses.map((option) => (
              <ToggleSquare key={option.value} selected={course === option.value} onClick={() => setCourse(option.value)} textSize={option.value === "MASTER" ? 13 : 15}>
                {option.label}
              </ToggleSquare>
            ))}
          </div>
          {fieldError("course", s.fieldError) ? <p className="m-0 text-12 font-semibold text-danger">{s.fieldError}</p> : null}
        </div>
        {errorLine}
        <button type="submit" disabled={pending} aria-busy={pending} className={submitClass}>
          {pending ? s.submitting : s.submit}
        </button>
      </form>
    );
  } else if (view === "details") {
    const b = c.businessForm;
    body = (
      <form className="flex flex-col gap-3.5" action={() => submitBusiness()}>
        <Heading>{b.title}</Heading>
        <Field label={b.name} htmlFor="biz-name" error={fieldError("name", b.fieldError)}>
          <Input id="biz-name" placeholder={b.namePlaceholder} value={bizName} onChange={(e) => setBizName(e.target.value)} invalid={invalid.includes("name")} />
        </Field>
        <Field label={b.address} htmlFor="biz-address" error={fieldError("address", b.fieldError)}>
          <Input id="biz-address" autoComplete="street-address" placeholder={b.addressPlaceholder} value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} invalid={invalid.includes("address")} />
        </Field>
        <Field label={b.tin} htmlFor="biz-tin" error={fieldError("tin", b.fieldError)}>
          <Input id="biz-tin" inputMode="numeric" maxLength={9} placeholder={b.tinPlaceholder} value={bizTin} onChange={(e) => setBizTin(e.target.value.replace(/\D/g, ""))} invalid={invalid.includes("tin")} mono={15} />
        </Field>
        <Field label={b.phone} htmlFor="biz-phone" error={fieldError("phone", b.fieldError)}>
          <PhoneInput id="biz-phone" quiet value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} invalid={invalid.includes("phone")} />
        </Field>
        <Field label={b.telegram} htmlFor="biz-telegram" error={fieldError("telegram", b.fieldError)}>
          <Input id="biz-telegram" autoCapitalize="none" placeholder={b.telegramPlaceholder} value={bizTelegram} onChange={(e) => setBizTelegram(e.target.value)} invalid={invalid.includes("telegram")} />
        </Field>
        <Field label={b.photo} htmlFor="biz-photo" hint={b.photoHint}>
          <label className="flex min-h-13 cursor-pointer items-center gap-2.5 rounded-12 border-hair border-dashed border-placeholder bg-white px-3.5 text-14 font-semibold">
            <Icon name="plus" size={18} strokeWidth={2.4} />
            <span className="min-w-0 flex-1 truncate">{photo ? photo.name : b.photoPick}</span>
            <input id="biz-photo" type="file" accept="image/jpeg,image/png,image/heic" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </Field>
        {errorLine}
        <button type="submit" disabled={pending} aria-busy={pending} className={submitClass}>
          {pending ? b.submitting : b.submit}
        </button>
      </form>
    );
  } else {
    const b = c.businessForm;
    body = (
      <div className="flex flex-col gap-3.5" data-testid="business-received">
        <span className="flex size-12 items-center justify-center rounded-full bg-green-bg text-green">
          <Icon name="tick" size={24} strokeWidth={2.6} />
        </span>
        <Heading>{b.received}</Heading>
        <p className="m-0 text-15 text-muted">{b.contact}</p>
        <p className="m-0 flex items-center gap-2 text-14 font-semibold">
          {b.status}: <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-13 text-warn">{b.pending}</span>
        </p>
        <Link href="/biznes" className={buttonClass({ variant: "orange", strong: true, block: true })}>
          {b.toPanel}
        </Link>
      </div>
    );
  }

  const showRole = view === "signin" || view === "methods";

  return (
    <div className="@container flex h-dvh flex-col overflow-hidden bg-paper @[920px]:flex-row text-ink">
      <div className={cn("relative box-border flex min-w-0 flex-none flex-col gap-[clamp(12px,3dvh,28px)] overflow-hidden p-[clamp(16px,3dvh,48px)] @[920px]:flex-[1_1_460px]", business ? "bg-ink text-paper" : "bg-blue text-white")}>
        <div aria-hidden="true" className={cn("pointer-events-none absolute -top-[120px] -right-[120px] size-[460px] rounded-[180px] border-[50px] border-solid", business ? "border-ink-2" : "border-blue-2")} />
        <Link href="/" className="relative self-start text-inherit no-underline">
          <Logo size={20} variant="white" tag={business ? "BIZNES" : undefined} />
        </Link>
        <div className="relative mt-auto hidden max-w-[520px] @[920px]:block">
          <h1 className="m-0 text-[clamp(36px,4.6cqw,64px)] leading-[0.95] font-black tracking-[-0.04em] font-stretch-112%">{c.headline[role]}</h1>
          <p className="mt-4 mb-0 text-17 leading-[1.5] opacity-85">{c.lead[role]}</p>
        </div>
      </div>

      <main className="box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto @[920px]:flex-[1_1_460px] px-[clamp(16px,4cqw,48px)] py-[clamp(12px,3dvh,48px)]">
        <div className="m-auto flex w-full max-w-[400px] flex-col gap-[clamp(10px,2dvh,20px)]">
          <div className="-mb-3 flex items-center justify-between">
            <BackButton variant="text" label={c.back} onClick={goBack} />
            <div role="group" aria-label={c.language} className="flex gap-1">
              {WEB_LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  aria-pressed={lang === l}
                  title={LANG_LABEL[l]}
                  onClick={() => setLang(l)}
                  className={cn("tap h-8 rounded-9 border-0 px-2 font-sans text-12 font-extrabold uppercase", lang === l ? "bg-ink text-white" : "bg-transparent text-muted")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          {showRole ? (
            <Segmented
              size="lg"
              label={c.student + " / " + c.business}
              value={role}
              onChange={(next) => {
                setRole(next);
                setError(null);
              }}
              options={[
                { value: "student", label: <><Icon name="student" size={18} />{c.student}</> },
                { value: "business", label: <><Icon name="store" size={18} />{c.business}</> },
              ]}
            />
          ) : null}
          {body}
          <p className="m-0 text-13 leading-[1.5] text-muted">
            {c.consent.lead}
            <Link href="/huquqiy/shartlar" className="tp-link font-bold text-ink underline">{c.consent.terms}</Link>
            {c.consent.and}
            <Link href="/huquqiy/maxfiylik" className="tp-link font-bold text-ink underline">{c.consent.privacy}</Link>
            {c.consent.tail}
          </p>
        </div>
      </main>
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">{children}</h2>;
}

function SignInForm({
  c,
  cta,
  pending,
  errorLine,
  invalid,
  onSubmit,
  onForgot,
  footer,
}: {
  c: WebAuthCopy;
  cta: string;
  pending: boolean;
  errorLine: ReactNode;
  invalid: boolean;
  onSubmit: (identifier: string, password: string) => void;
  onForgot: () => void;
  footer: ReactNode;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const s = c.signin;
  return (
    <div className="flex flex-col gap-3.5">
      <Heading>{s.title}</Heading>
      <form
        className="flex flex-col gap-3.5"
        action={() => {
          if (identifier.trim() && password) onSubmit(identifier, password);
        }}
      >
        <Field label={s.identifier} htmlFor="signin-identifier">
          <Input
            id="signin-identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={s.identifierPlaceholder}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            invalid={invalid}
            autoFocus
          />
        </Field>
        <Field label={c.password.label} htmlFor="signin-password">
          <PasswordInput id="signin-password" value={password} onChange={setPassword} autoComplete="current-password" invalid={invalid} copy={c.password} />
        </Field>
        {errorLine}
        <button type="submit" disabled={pending} aria-busy={pending} className={cta}>
          {pending ? s.submitting : s.submit}
        </button>
        <button type="button" onClick={onForgot} className="tp-link self-start border-0 bg-transparent p-0 font-sans text-13 font-bold text-ink underline">
          {s.forgot}
        </button>
      </form>
      {footer}
    </div>
  );
}
