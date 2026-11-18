"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PasswordBox, StrengthBars } from "@/components/ui/app-code";
import {
  AppLabel,
  AppLead,
  AppScreen,
  AppTitle,
  BackArrow,
  FieldNote,
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
