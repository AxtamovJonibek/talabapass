"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PasswordBox, StrengthBars } from "@/components/ui/app-code";
import {
  AppLabel,
  AppLead,
  AppLogo,
  AppScreen,
  AppTitle,
  BackArrow,
  FieldNote,
  FooterButton,
  Highlight,
  IconTile,
  RoleChip,
  StepBars,
  TickDot,
  TopBar,
} from "@/components/ui/app-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { passwordRules, passwordStrength } from "@/lib/password";

type Common = {
  onBack: () => void;
  pending: boolean;
  errorText: string | null;
};

/** 12 · Parol bilan kirish (hisob topildi). */
export function PasswordScreen({
  masked,
  initial,
  onSubmit,
  onForgot,
  onOtherPhone,
  onBack,
  pending,
  errorText,
}: Common & { masked: string; initial: string | null; onSubmit: (password: string) => void; onForgot: () => void; onOtherPhone: () => void }) {
  const t = useTranslations("app.login");
  const common = useTranslations("app");
  const [password, setPassword] = useState("");

  return (
    <AppScreen>
      <TopBar>
        <BackArrow label={common("back")} onClick={onBack} />
        <AppLogo />
      </TopBar>
      <form
        className="flex flex-1 flex-col"
        action={() => {
          if (password) onSubmit(password);
        }}
      >
        <div className="mt-9">
          <div className="flex items-center gap-3.5">
            <span className="flex size-15 -rotate-6 items-center justify-center rounded-full bg-green-bright text-24 font-black">
              {initial ?? <Icon name="user" size={26} strokeWidth={2.4} />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-14 font-semibold text-muted">{t("found")}</span>
              <span className="text-20 font-extrabold tabular-nums">{masked}</span>
            </span>
          </div>
          <AppTitle size={42} className="mt-6">
            {t.rich("passwordTitle", { hl: (chunks: ReactNode) => <Highlight tone="orange">{chunks}</Highlight> })}
          </AppTitle>
        </div>

        <div className="mt-7 flex flex-col">
          <AppLabel htmlFor="app-password">{t("passwordLabel")}</AppLabel>
          <PasswordBox
            id="app-password"
            name="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            height={64}
            invalid={Boolean(errorText)}
            autoFocus
            toggleLabels={{ show: t("showPassword"), hide: t("hidePassword") }}
          />
          {errorText ? <FieldNote error>{errorText}</FieldNote> : null}
          <button type="button" onClick={onForgot} className="mt-1.5 flex min-h-11 items-center self-start border-0 bg-transparent p-0 font-sans text-15 font-extrabold text-blue underline">
            {t("forgot")}
          </button>
        </div>

        <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-3")}>
          {pending ? t("signingIn") : t("signIn")}
          <Icon name="arrowRight" size={22} strokeWidth={2.4} />
        </button>
        <div className="flex-1" />
        <FooterButton lead={t("otherNumber")} onClick={onOtherPhone} />
      </form>
    </AppScreen>
  );
}

/** 7 · Parol o'rnatish (yangi raqam, parolsiz eski hisob) va "Parolni unutdim" — B5 ParolBiznes ham shu (yorliq rolga qarab). */
export function SetPasswordScreen({
  mode,
  role,
  onSubmit,
  onBack,
  pending,
  errorText,
  mismatch,
}: Common & { mode: "new" | "missing" | "reset"; role: "student" | "business"; onSubmit: (password: string, confirm: string) => void; mismatch: boolean }) {
  const t = useTranslations("app.login");
  const common = useTranslations("app");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const rules = passwordRules(password);
  const score = passwordStrength(password);
  const matches = confirm.length > 0 && confirm.trim() === password.trim();
  const reset = mode === "reset";

  return (
    <AppScreen>
      <TopBar>
        <BackArrow label={common("back")} onClick={onBack} />
        <StepBars total={3} current={3} label={t("setSteps")} />
        <RoleChip tone={role}>{common(`role.${role}`)}</RoleChip>
      </TopBar>
      <form className="flex flex-1 flex-col" action={() => onSubmit(password, confirm)}>
        <div className="mt-8">
          <IconTile icon="lock" />
          <AppTitle size={42} className="mt-5">
            {t(reset ? "resetTitle" : "setTitle")}
          </AppTitle>
          <AppLead size={16} className="mt-3">
            {t(reset ? "resetLead" : "setLead")}
          </AppLead>
        </div>

        <div className="mt-6">
          <AppLabel htmlFor="app-new-password">{t("passwordLabel")}</AppLabel>
          <PasswordBox
            id="app-new-password"
            name="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalid={Boolean(errorText) && !mismatch}
            autoFocus
            toggleLabels={{ show: t("showPassword"), hide: t("hidePassword") }}
          />
          <StrengthBars score={score} label={score > 0 ? t(`strength.${score as 1}`) : null} />
          <ul className="m-0 mt-3.5 flex list-none flex-col gap-2 p-0">
            {(["length", "mix"] as const).map((rule) => (
              <li key={rule} className="flex items-center gap-2.5 text-14 font-semibold">
                <TickDot tone={rules[rule] ? "green" : "idle"} />
                {t(rule === "length" ? "ruleLength" : "ruleMix")}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <AppLabel htmlFor="app-repeat-password">{t("repeatLabel")}</AppLabel>
          <PasswordBox
            id="app-repeat-password"
            name="confirm"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            invalid={mismatch}
            trailing={matches ? <TickDot size={26} /> : null}
          />
          {errorText ? <FieldNote error>{errorText}</FieldNote> : null}
        </div>

        <div className="flex-1" />
        <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-6")}>
          {pending ? t("saving") : t(mode === "new" ? "continue" : "save")}
          <Icon name="arrowRight" size={22} strokeWidth={2.4} />
        </button>
      </form>
    </AppScreen>
  );
}
