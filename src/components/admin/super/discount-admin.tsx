"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DealBadge, ToneBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { discountTerms, type DiscountDraft } from "@/lib/discount";
import { formatMinute, parseMinute } from "@/lib/time";
import { deleteDiscountAdminAction, saveDiscountAdminAction, setDiscountStatusAdminAction } from "@/server/actions/admin-super";
import { ConfirmAction } from "./controls";

export type AdminDiscount = DiscountDraft & { id: string; status: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "ENDED" };

const TONE = { ACTIVE: "ok", PAUSED: "info", PENDING_REVIEW: "warn", DRAFT: "info", REJECTED: "bad", ENDED: "info" } as const;

/**
 * Admin uchun chegirma qatori: yorliq, nom, holat; to'xtatish/yoqish, o'chirish (tasdiq bilan), to'liq tahrirlash
 * (qayta tekshiruvsiz). Qoidalar serverda `validateDiscount`; xato maydonlar qizil.
 */
export function DiscountAdminRow({ discount }: { discount: AdminDiscount }) {
  const t = useTranslations("adminSuper.partners.discounts");
  const state = useTranslations("adminSuper.discountStatus");
  const status = useTranslations("adminSuper");
  const types = useTranslations("discountType");
  const weekday = useTranslations("weekday.short");
  const problems = useTranslations("discountEditor.errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(discount as DiscountDraft);
  const [from, setFrom] = useState(formatMinute(discount.fromMinute ?? 0));
  const [to, setTo] = useState(formatMinute((discount.toMinute ?? 0) % 1440));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof DiscountDraft>(key: K, value: DiscountDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")));
  const badge = discountTerms(discount).badge;
  const id = (k: string) => `d-${discount.id}-${k}`;

  const toggleStatus = () =>
    start(async () => {
      const r = await setDiscountStatusAdminAction({ discountId: discount.id, active: discount.status === "PAUSED" });
      setMessage(r.ok ? null : status("errors.failed"));
      router.refresh();
    });

  const save = () =>
    start(async () => {
      setMessage(null);
      const toMinute = parseMinute(to);
      const r = await saveDiscountAdminAction({ discountId: discount.id, draft: { ...draft, fromMinute: parseMinute(from), toMinute: toMinute === 0 ? 1440 : toMinute } });
      setErrors(r.problems ?? {});
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else setMessage(status(r.error === "errors" ? "errors.errors" : "errors.failed"));
    });

  const err = (k: string) => (errors[k] ? problems(errors[k] as "title") : null);

  return (
    <li className="flex flex-col gap-2 border-0 border-b border-solid border-surface py-3" data-testid="admin-discount">
      <div className="flex flex-wrap items-center gap-3">
        {badge ? <DealBadge size="sm">{badge}</DealBadge> : null}
        <span className="min-w-0 flex-1">
          <b className="text-14">{discount.title}</b>
          <div className="text-12 text-muted">
            {discount.startsOn} – {discount.endsOn} · {formatMinute(discount.fromMinute ?? 0)}–{formatMinute((discount.toMinute ?? 0) % 1440)}
          </div>
        </span>
        <ToneBadge tone={TONE[discount.status]}>{state(discount.status)}</ToneBadge>
        {discount.status === "ACTIVE" || discount.status === "PAUSED" ? (
          <Button variant="outline-soft" size="sm" loading={pending} onClick={toggleStatus} data-testid="admin-discount-toggle">
            {discount.status === "ACTIVE" ? t("pause") : t("resume")}
          </Button>
        ) : null}
        <Button variant="outline-soft" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? t("close") : t("edit")}
        </Button>
      </div>
      {message ? (
        <p role="alert" className="m-0 text-13 font-bold text-danger">
          {message}
        </p>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-3 rounded-12 bg-paper p-3">
          <p className="m-0 text-12 text-muted">{t("editHint")}</p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3">
            <Field label={t("fields.title")} htmlFor={id("title")} error={err("title")}>
              <Input id={id("title")} compact value={draft.title} onChange={(e) => set("title", e.target.value)} invalid={Boolean(errors.title)} />
            </Field>
            <Field label={t("fields.type")} htmlFor={id("type")}>
              <Select native compact id={id("type")} value={draft.type} onChange={(e) => set("type", e.target.value as DiscountDraft["type"])}>
                {(["PERCENT", "FIXED_PRICE", "BOGO"] as const).map((k) => (
                  <option key={k} value={k}>
                    {types(k)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("fields.originalPrice")} htmlFor={id("orig")} error={err("originalPrice")}>
              <Input id={id("orig")} compact mono={14} inputMode="numeric" value={draft.originalPrice ?? ""} onChange={(e) => set("originalPrice", num(e.target.value))} invalid={Boolean(errors.originalPrice)} />
            </Field>
            {draft.type === "PERCENT" ? (
              <Field label={t("fields.percent")} htmlFor={id("pct")} error={err("percent")}>
                <Input id={id("pct")} compact mono={14} inputMode="numeric" value={draft.percent ?? ""} onChange={(e) => set("percent", num(e.target.value))} invalid={Boolean(errors.percent)} />
              </Field>
            ) : null}
            {draft.type === "FIXED_PRICE" ? (
              <Field label={t("fields.newPrice")} htmlFor={id("new")} error={err("newPrice")}>
                <Input id={id("new")} compact mono={14} inputMode="numeric" value={draft.newPrice ?? ""} onChange={(e) => set("newPrice", num(e.target.value))} invalid={Boolean(errors.newPrice)} />
              </Field>
            ) : null}
            <Field label={t("fields.from")} htmlFor={id("from")} error={err("time")}>
              <Input id={id("from")} compact mono={14} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="12:00" invalid={Boolean(errors.time)} />
            </Field>
            <Field label={t("fields.to")} htmlFor={id("to")}>
              <Input id={id("to")} compact mono={14} value={to} onChange={(e) => setTo(e.target.value)} placeholder="15:00" invalid={Boolean(errors.time)} />
            </Field>
            <Field label={t("fields.dailyLimit")} htmlFor={id("limit")} error={err("dailyLimit")}>
              <Input id={id("limit")} compact mono={14} inputMode="numeric" value={draft.dailyLimit ?? ""} onChange={(e) => set("dailyLimit", num(e.target.value))} invalid={Boolean(errors.dailyLimit)} />
            </Field>
            <Field label={t("fields.perStudentLimit")} htmlFor={id("per")}>
              <Select native compact id={id("per")} value={draft.perStudentLimit} onChange={(e) => set("perStudentLimit", e.target.value as DiscountDraft["perStudentLimit"])}>
                {(["DAILY", "WEEKLY", "UNLIMITED"] as const).map((k) => (
                  <option key={k} value={k}>
                    {t(`limits.${k}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("fields.startsOn")} htmlFor={id("starts")} error={err("dates")}>
              <Input id={id("starts")} type="date" compact value={draft.startsOn} onChange={(e) => set("startsOn", e.target.value)} invalid={Boolean(errors.dates)} />
            </Field>
            <Field label={t("fields.endsOn")} htmlFor={id("ends")}>
              <Input id={id("ends")} type="date" compact value={draft.endsOn} onChange={(e) => set("endsOn", e.target.value)} invalid={Boolean(errors.dates)} />
            </Field>
          </div>
          <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
            <legend className="mb-1.5 p-0 text-13 font-semibold">{t("fields.weekdays")}</legend>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-13">
                <input
                  type="checkbox"
                  checked={draft.weekdays.includes(d)}
                  onChange={(e) => set("weekdays", e.target.checked ? [...draft.weekdays, d].sort((a, b) => a - b) : draft.weekdays.filter((x) => x !== d))}
                />
                {weekday(String(d) as "1")}
              </label>
            ))}
          </fieldset>
          {err("weekdays") ? <p className="m-0 text-12 font-semibold text-danger">{err("weekdays")}</p> : null}
          <Field label={t("fields.terms")} htmlFor={id("terms")} error={err("terms")}>
            <Input id={id("terms")} compact value={draft.terms} onChange={(e) => set("terms", e.target.value)} maxLength={220} />
          </Field>
          <div className="flex flex-wrap items-start gap-3">
            <Button variant="ink" size="sm" loading={pending} onClick={save} data-testid="admin-discount-save">
              {status("save")}
            </Button>
            <ConfirmAction label={t("delete")} confirmText={t("deleteConfirm")} run={() => deleteDiscountAdminAction({ discountId: discount.id })} danger testId="admin-discount-delete" />
          </div>
        </div>
      ) : null}
    </li>
  );
}
