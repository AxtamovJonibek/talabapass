"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CodeEntry, OTP_LENGTH, RESEND_SECONDS } from "@/components/auth/code-entry";
import { Button } from "@/components/ui/button";
import { Field, Input, PhoneInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { acceptInviteAction, type AcceptField } from "@/server/actions/cashiers";

type Values = { phone: string; firstName: string; lastName: string };

/** Kassir taklifini qabul qilish (dizaynda chizilmagan — B1 sarlavhasi va kirish sahifasidagi kod bloki). */
export function AcceptInvite({ token, businessName }: { token: string; businessName: string }) {
  const t = useTranslations("cashiers.accept");
  const auth = useTranslations("auth");
  const brand = useTranslations("brand");
  const [values, setValues] = useState<Values | null>(null);
  const [invalid, setInvalid] = useState<AcceptField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [codePhone, setCodePhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function send(next: Values, otp?: string) {
    setValues(next);
    setInvalid([]);
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction({ token, ...next, code: otp });
      if (!result) return;
      if (result.ok) {
        setCodePhone(result.phone);
        setCode("");
        setResendIn(result.retryInSeconds ?? RESEND_SECONDS);
      } else if ("fields" in result) {
        setInvalid(result.fields);
      } else {
        const known = ["invalid", "phoneInUse", "otherBusiness", "blocked"] as const;
        const seconds = result.retryInSeconds ?? 0;
        setError(
          (known as readonly string[]).includes(result.error)
            ? t(`errors.${result.error as (typeof known)[number]}`)
            : auth(`errors.${result.error as "wrongCode"}`, { seconds, minutes: Math.ceil(seconds / 60) }),
        );
        setCode("");
      }
    });
  }

  const fieldError = (f: AcceptField) => (invalid.includes(f) ? t(`errors.${f}`) : undefined);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col bg-paper px-5 pt-14 pb-8 text-ink">
      <Logo size={17} chip="ink" tag={brand("business")} tagSize="md" />
      <h1 className="mt-6 mb-0 text-28 leading-[1.02] font-black tracking-[-0.03em] font-stretch-110%">{t("title")}</h1>
      <p className="mt-2 mb-0 text-14 leading-[1.45] text-muted">{t("lead", { business: businessName })}</p>

      {codePhone && values ? (
        <form
          className="mt-6 flex flex-1 flex-col gap-4"
          action={() => {
            if (code.length === OTP_LENGTH) send(values, code);
          }}
        >
          <CodeEntry
            phone={codePhone}
            code={code}
            onCode={setCode}
            onComplete={(c) => send(values, c)}
            onResend={() => send(values)}
            onChangePhone={() => setCodePhone(null)}
            resendIn={resendIn}
            pending={pending}
            invalid={Boolean(error)}
            errorText={error}
          />
          <Button type="submit" variant="orange" spread block disabled={pending} aria-busy={pending} className="mt-auto">
            <span>{pending ? auth("checking") : t("confirm")}</span>
            <Icon name="arrowRight" size={22} strokeWidth={2.2} />
          </Button>
        </form>
      ) : (
        <form
          className="mt-6 flex flex-1 flex-col gap-3"
          action={(form) =>
            send({ phone: String(form.get("phone") ?? ""), firstName: String(form.get("firstName") ?? ""), lastName: String(form.get("lastName") ?? "") })
          }
        >
          <div className="grid grid-cols-2 gap-2.5">
            <Field label={t("firstName")} htmlFor="inv-first" error={fieldError("firstName")}>
              <Input id="inv-first" name="firstName" dense autoComplete="given-name" defaultValue={values?.firstName} invalid={invalid.includes("firstName")} />
            </Field>
            <Field label={t("lastName")} htmlFor="inv-last" error={fieldError("lastName")}>
              <Input id="inv-last" name="lastName" dense autoComplete="family-name" defaultValue={values?.lastName} invalid={invalid.includes("lastName")} />
            </Field>
          </div>
          <Field label={t("phone")} htmlFor="inv-phone" error={fieldError("phone") ?? error}>
            <PhoneInput id="inv-phone" name="phone" defaultValue={values?.phone} invalid={invalid.includes("phone")} />
          </Field>
          <Button type="submit" variant="orange" spread block disabled={pending} aria-busy={pending} className="mt-auto">
            <span>{pending ? auth("sending") : t("submit")}</span>
            <Icon name="arrowRight" size={22} strokeWidth={2.2} />
          </Button>
        </form>
      )}
    </main>
  );
}
