"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";
import { passwordRules } from "@/lib/password";

/**
 * Yangi parol + takrorlash va qoidalar ("Kamida 8 ta belgi", "Harf va raqam birga") — sayt: ro'yxat, tiklash,
 * majburiy parol va profildan almashtirish. Qiymatlar formaga `password` va `confirm` nomlari bilan ketadi.
 */
export function NewPasswordFields({ idPrefix, errorText, mismatch = false, autoFocus = true }: { idPrefix: string; errorText?: string | null; mismatch?: boolean; autoFocus?: boolean }) {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const rules = passwordRules(password);
  const toggle = { show: t("showPassword"), hide: t("hidePassword") };

  return (
    <>
      <Field label={t("setPassword.newLabel")} htmlFor={`${idPrefix}-password`}>
        <PasswordInput
          id={`${idPrefix}-password`}
          name="password"
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={Boolean(errorText) && !mismatch}
          toggleLabels={toggle}
        />
      </Field>
      <ul className="m-0 -mt-1.5 flex list-none flex-col gap-1.5 p-0">
        {(["length", "mix"] as const).map((rule) => (
          <li key={rule} className={cn("flex items-center gap-2 text-13 font-semibold", rules[rule] ? "text-green" : "text-muted")}>
            <Icon name={rules[rule] ? "checkCircle" : "info"} size={16} />
            {t(rule === "length" ? "setPassword.ruleLength" : "setPassword.ruleMix")}
          </li>
        ))}
      </ul>
      <Field label={t("setPassword.repeatLabel")} htmlFor={`${idPrefix}-confirm`} error={errorText}>
        <PasswordInput
          id={`${idPrefix}-confirm`}
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          invalid={mismatch}
          toggleLabels={toggle}
        />
      </Field>
    </>
  );
}
