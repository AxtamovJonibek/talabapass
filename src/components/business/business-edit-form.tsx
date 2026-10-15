"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { DESCRIPTION_MAX } from "@/lib/business";
import { editBusinessAction, type BusinessEditState } from "@/server/actions/business-profile";

type Initial = { name: string; address: string; workingHours: string; description: string };
const IDLE: BusinessEditState = { status: "idle" };

/** B5 "Tahrirlash": nom, manzil, ish vaqti, tavsif. Nom/manzil o'zgarsa biznes qayta tekshiruvga tushadi. */
export function BusinessEditForm({ initial, idPrefix }: { initial: Initial; idPrefix: string }) {
  const t = useTranslations("businessOnboarding");
  const e = useTranslations("businessProfile");
  const [state, formAction, pending] = useActionState(editBusinessAction, IDLE);
  const bad = (field: string) => state.status === "error" && state.fields.includes(field);
  const err = (field: "name" | "address" | "workingHours" | "description") => (bad(field) ? t(`errors.${field}`) : null);
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <Field label={t("name")} htmlFor={id("name")} error={err("name")}>
        <Input id={id("name")} name="name" defaultValue={initial.name} maxLength={60} invalid={bad("name")} />
      </Field>
      <Field label={t("address")} htmlFor={id("address")} error={err("address")}>
        <Input id={id("address")} name="address" defaultValue={initial.address} maxLength={160} invalid={bad("address")} />
      </Field>
      <Field label={t("workingHours")} htmlFor={id("hours")} error={err("workingHours")}>
        <Input id={id("hours")} name="workingHours" mono={14} defaultValue={initial.workingHours} placeholder={t("workingHoursPlaceholder")} invalid={bad("workingHours")} />
      </Field>
      <Field label={t("description")} htmlFor={id("desc")} error={err("description")}>
        <Textarea id={id("desc")} name="description" rows={3} maxLength={DESCRIPTION_MAX} defaultValue={initial.description} invalid={bad("description")} />
      </Field>
      <p className="m-0 text-12 leading-[1.45] text-muted">{e("editNote")}</p>
      <Button type="submit" variant="orange" size="lg" disabled={pending}>
        {e("editSave")}
      </Button>
      {state.status === "saved" ? (
        <p role="status" data-testid="business-saved" className="m-0 text-13 font-bold text-green">
          {state.rereview ? e("savedRereview") : e("saved")}
        </p>
      ) : null}
      {state.status === "notEditable" ? (
        <p role="alert" className="m-0 text-13 font-bold text-danger">
          {e("notEditable")}
        </p>
      ) : null}
    </form>
  );
}
