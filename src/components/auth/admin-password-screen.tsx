"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";
import { logoutAction } from "@/server/actions/auth";
import { verifyAdminPasswordAction, type AdminPasswordResult } from "@/server/actions/admin-auth";

/**
 * Admin ikkinchi qadami: SMS koddan keyin parol. Dizaynda chizilmagan — W2 o'ng ustuni va mavjud primitivlardan
 * (Field, Input, Button), admin mavzusi (#EEEDE8 fon, ko'k urg'u).
 */
export function AdminPasswordScreen() {
  const t = useTranslations("auth.admin");
  const common = useTranslations("common");
  const brand = useTranslations("brand");
  const [failure, setFailure] = useState<AdminPasswordResult | null>(null);
  const [pending, startTransition] = useTransition();

  const errorText = failure
    ? t(`errors.${failure.error}`, { minutes: Math.ceil((failure.retryInSeconds ?? 0) / 60) })
    : null;

  return (
    <main className="box-border flex min-h-screen items-center justify-center bg-admin-bg px-[clamp(16px,4cqw,48px)] py-[clamp(24px,5cqw,64px)] text-ink">
      <div className="flex w-full max-w-[440px] flex-col gap-5">
        <Logo size={20} tag={brand("admin")} />
        <div>
          <h1 className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">{t("title")}</h1>
          <p className="mt-1.5 mb-0 text-15 text-muted">{t("subtitle")}</p>
        </div>
        <form
          className="flex flex-col gap-3.5"
          action={(form) => {
            setFailure(null);
            startTransition(async () => {
              // To'g'ri bo'lsa server yo'naltiradi; bu yerga faqat xato qaytadi.
              const result = await verifyAdminPasswordAction(String(form.get("password") ?? ""));
              if (result) setFailure(result);
            });
          }}
        >
          <Field label={t("passwordLabel")} htmlFor="admin-password" error={errorText}>
            <Input id="admin-password" name="password" type="password" autoComplete="current-password" autoFocus required invalid={!!failure} />
          </Field>
          <button type="submit" disabled={pending || failure?.error === "locked"} className={buttonClass({ variant: "blue", strong: true })}>
            {pending ? t("checking") : t("submit")}
          </button>
        </form>
        <form action={logoutAction}>
          <button type="submit" className={buttonClass({ variant: "ghost" })}>
            {common("logout")}
          </button>
        </form>
      </div>
    </main>
  );
}
