"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BackLink } from "@/components/ui/back-button";
import { buttonClass } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { logoutAction, ownPasswordAction, type AuthError } from "@/server/actions/auth";
import { NewPasswordFields } from "./new-password-fields";

export type OwnPasswordMode = "set" | "required" | "change";

/**
 * Kirgan foydalanuvchining paroli (dizaynda yo'q — W2 o'ng ustuni va mavjud primitivlardan):
 * `set` — parolsiz eski hisob, `required` — admin tiklashni so'ragan (ikkalasida ham ichkariga faqat shundan keyin),
 * `change` — profildan almashtirish (joriy parol bilan).
 */
export function OwnPasswordScreen({ mode, backHref, business }: { mode: OwnPasswordMode; backHref: string; business: boolean }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const [failure, setFailure] = useState<{ error: AuthError; retryInSeconds?: number; left?: number } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const errorText = failure
    ? t(`errors.${failure.error}`, { minutes: Math.max(1, Math.ceil((failure.retryInSeconds ?? 0) / 60)), seconds: failure.retryInSeconds ?? 0, left: failure.left ?? 0 })
    : null;

  return (
    <main className="box-border flex min-h-screen items-center justify-center bg-paper px-[clamp(16px,4cqw,48px)] py-[clamp(24px,5cqw,64px)] text-ink">
      <div className="flex w-full max-w-[440px] flex-col gap-5">
        {mode === "change" ? <BackLink href={backHref} variant="text" className="-mb-3 self-start" /> : null}
        <Logo size={20} />
        <div>
          <h1 className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">{t(`ownPassword.${mode}Title`)}</h1>
          <p className="mt-1.5 mb-0 text-15 text-muted">{t(`ownPassword.${mode}Lead`)}</p>
        </div>
        <form
          key={formKey}
          className="flex flex-col gap-3.5"
          action={(form) => {
            setFailure(null);
            startTransition(async () => {
              const result = await ownPasswordAction(String(form.get("current") ?? ""), String(form.get("password") ?? ""), String(form.get("confirm") ?? ""));
              // Majburiy rejimda muvaffaqiyat — server yo'naltiradi
              if (!result) return;
              if (!result.ok) return setFailure(result);
              toast(t("ownPassword.saved"), "ok");
              setFormKey((k) => k + 1);
            });
          }}
        >
          {mode === "change" ? (
            <Field label={t("ownPassword.currentLabel")} htmlFor="own-current">
              <PasswordInput
                id="own-current"
                name="current"
                autoComplete="current-password"
                autoFocus
                invalid={failure?.error === "wrongCurrent"}
                toggleLabels={{ show: t("showPassword"), hide: t("hidePassword") }}
              />
            </Field>
          ) : null}
          <NewPasswordFields idPrefix="own" errorText={errorText} mismatch={failure?.error === "mismatch"} autoFocus={mode !== "change"} />
          <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass({ variant: business ? "orange" : "blue", strong: true })}>
            {pending ? t("setPassword.saving") : t("ownPassword.save")}
          </button>
        </form>
        {mode === "change" ? null : (
          <form action={logoutAction}>
            <button type="submit" className={buttonClass({ variant: "ghost" })}>
              {common("logout")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
