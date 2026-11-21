"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ConfirmAction } from "@/components/admin/super/controls";
import { DealBadge, ToneBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { discountTerms, type DiscountDraft } from "@/lib/discount";
import { DAY_PRESETS, DAYS, hoursFor, parseSchedule, TIME_PRESETS, timeOptions, timePresetOf, type HoursLabels, type Range } from "@/lib/hours";
import { formatMinute } from "@/lib/time";
import { createDiscountForBusinessAction, duplicateDiscountAction } from "@/server/actions/admin-business";
import { deleteDiscountAdminAction, saveDiscountAdminAction, setDiscountStatusAdminAction, type SuperActionResult } from "@/server/actions/admin-super";

export type OpsDiscount = DiscountDraft & {
  id: string;
  status: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "ENDED";
  sold: number;
};

const TONE = { ACTIVE: "ok", PAUSED: "info", PENDING_REVIEW: "warn", DRAFT: "info", REJECTED: "bad", ENDED: "info" } as const;
const TIME_KEYS = ["morning", "lunch", "evening", "allDay"] as const;
const digits = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")));
const chip = (on: boolean) => cn("tp-lift h-8 rounded-8 border-hair px-3 text-13 font-semibold", on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink");
const sameDays = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((d) => b.includes(d));

/** Yangi chegirma uchun boshlang'ich qiymatlar: bugundan 30 kun, har kuni, ish vaqti bo'yicha soat (yo'q bo'lsa 09:00–21:00) */
export function emptyDraft(today: string, range: Range | null): DiscountDraft {
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  return {
    title: "",
    type: "PERCENT",
    originalPrice: null,
    percent: null,
    newPrice: null,
    weekdays: [...DAY_PRESETS.everyDay],
    fromMinute: range?.from ?? 9 * 60,
    toMinute: range?.to ?? 21 * 60,
    dailyLimit: null,
    perStudentLimit: "DAILY",
    startsOn: today,
    endsOn: end.toISOString().slice(0, 10),
    terms: "",
  };
}

/**
 * Chegirma formasi (yaratish va tahrirlash): kunlik son — faqat raqam; kunlar va soat — tugmalar (tayyor oraliqlar,
 * "Boshqa vaqt" — 30 daqiqa qadamli ro'yxat); muddat — sana tanlagich. Qoidalar serverda `validateDiscount`; xato maydonlar qizil.
 */
function DiscountForm({
  initial,
  workingHours,
  submitLabel,
  onSubmit,
  onCancel,
  idPrefix,
}: {
  initial: DiscountDraft;
  workingHours: string;
  submitLabel: string;
  onSubmit: (draft: DiscountDraft) => Promise<SuperActionResult>;
  onCancel: () => void;
  idPrefix: string;
}) {
  const t = useTranslations("adminBusiness.ops.form");
  const types = useTranslations("discountType");
  const hoursT = useTranslations("adminBusiness.hours");
  const problems = useTranslations("discountEditor.errors");
  const failed = useTranslations("adminSuper.errors");
  const [draft, setDraft] = useState(initial);
  const [other, setOther] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof DiscountDraft>(key: K, value: DiscountDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const id = (k: string) => `${idPrefix}-${k}`;
  const err = (k: string) => (errors[k] ? problems(errors[k] as "title") : null);

  const labels: HoursLabels = { short: (d) => (hoursT.raw("short") as string[])[d - 1]!, everyDay: hoursT("every") };
  const schedule = parseSchedule(workingHours, labels);
  const businessRange = schedule ? hoursFor(draft.weekdays, schedule) : null;
  const range: Range = { from: draft.fromMinute ?? 0, to: draft.toMinute ?? 0 };
  const preset = timePresetOf(range);
  const isBusinessHours = businessRange !== null && businessRange.from === range.from && businessRange.to === range.to;
  const showOther = other || (!preset && !isBusinessHours);
  const setRange = (r: Range) => {
    set("fromMinute", r.from);
    set("toMinute", r.to);
  };

  const submit = () =>
    start(async () => {
      setMessage(null);
      const r = await onSubmit(draft);
      setErrors(r.problems ?? {});
      if (!r.ok) setMessage(failed((r.fields?.includes("reason") ? "reason" : r.error === "errors" ? "errors" : (r.error ?? "failed")) as "failed"));
    });

  return (
    <div className="flex flex-col gap-3 rounded-12 bg-paper p-3" data-testid="ops-discount-form">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3">
        <Field label={t("title")} htmlFor={id("title")} error={err("title")}>
          <Input id={id("title")} compact value={draft.title} onChange={(e) => set("title", e.target.value)} invalid={Boolean(errors.title)} maxLength={80} />
        </Field>
        <Field label={t("type")} htmlFor={id("type")}>
          <Select native compact id={id("type")} value={draft.type} onChange={(e) => set("type", e.target.value as DiscountDraft["type"])}>
            {(["PERCENT", "FIXED_PRICE", "BOGO"] as const).map((k) => (
              <option key={k} value={k}>
                {types(k)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("originalPrice")} htmlFor={id("orig")} error={err("originalPrice")}>
          <Input id={id("orig")} compact mono={14} inputMode="numeric" value={draft.originalPrice ?? ""} onChange={(e) => set("originalPrice", digits(e.target.value))} invalid={Boolean(errors.originalPrice)} />
        </Field>
        {draft.type === "PERCENT" ? (
          <Field label={t("percent")} htmlFor={id("pct")} error={err("percent")}>
            <Input id={id("pct")} compact mono={14} inputMode="numeric" value={draft.percent ?? ""} onChange={(e) => set("percent", digits(e.target.value))} invalid={Boolean(errors.percent)} />
          </Field>
        ) : null}
        {draft.type === "FIXED_PRICE" ? (
          <Field label={t("newPrice")} htmlFor={id("new")} error={err("newPrice")}>
            <Input id={id("new")} compact mono={14} inputMode="numeric" value={draft.newPrice ?? ""} onChange={(e) => set("newPrice", digits(e.target.value))} invalid={Boolean(errors.newPrice)} />
          </Field>
        ) : null}
        <Field label={t("dailyLimit")} htmlFor={id("limit")} error={err("dailyLimit")}>
          <Input id={id("limit")} compact mono={14} inputMode="numeric" value={draft.dailyLimit ?? ""} onChange={(e) => set("dailyLimit", digits(e.target.value))} invalid={Boolean(errors.dailyLimit)} />
        </Field>
        <Field label={t("perStudent")} htmlFor={id("per")}>
          <Select native compact id={id("per")} value={draft.perStudentLimit} onChange={(e) => set("perStudentLimit", e.target.value as DiscountDraft["perStudentLimit"])}>
            {(["DAILY", "WEEKLY", "UNLIMITED"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`limits.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-13 font-semibold">{t("days")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {(["everyDay", "workdays", "weekend"] as const).map((k) => (
            <button key={k} type="button" onClick={() => set("weekdays", [...DAY_PRESETS[k]])} className={chip(sameDays(draft.weekdays, DAY_PRESETS[k]))}>
              {hoursT(k === "everyDay" ? "every" : k)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => {
            const on = draft.weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => set("weekdays", on ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d].sort((a, b) => a - b))}
                className={cn("tp-lift size-9 rounded-8 border-hair text-13 font-bold", on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}
              >
                {(hoursT.raw("short") as string[])[d - 1]}
              </button>
            );
          })}
        </div>
        {err("weekdays") ? <p className="m-0 text-12 font-semibold text-danger">{err("weekdays")}</p> : null}
      </fieldset>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-13 font-semibold">{t("time")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {businessRange ? (
            <button type="button" onClick={() => (setOther(false), setRange(businessRange))} className={chip(isBusinessHours && !other)} data-testid="time-business">
              {t("timePresets.business")}
            </button>
          ) : null}
          {TIME_KEYS.map((k) => (
            <button key={k} type="button" onClick={() => (setOther(false), setRange(TIME_PRESETS[k]))} className={chip(!other && !isBusinessHours && preset === k)} data-testid={`time-${k}`}>
              {t(`timePresets.${k}`)}
            </button>
          ))}
          <button type="button" onClick={() => setOther(true)} className={chip(showOther)} data-testid="time-other">
            {t("timePresets.other")}
          </button>
        </div>
        {showOther ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-13 text-muted">
              {t("from")}
              <Select native compact value={range.from} onChange={(e) => set("fromMinute", Number(e.target.value))} aria-label={t("from")} invalid={Boolean(errors.time)}>
                {timeOptions("from", range.from).map((m) => (
                  <option key={m} value={m}>
                    {formatMinute(m)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-1.5 text-13 text-muted">
              {t("to")}
              <Select native compact value={range.to} onChange={(e) => set("toMinute", Number(e.target.value))} aria-label={t("to")} invalid={Boolean(errors.time)}>
                {timeOptions("to", range.to).map((m) => (
                  <option key={m} value={m}>
                    {formatMinute(m % 1440)}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        ) : null}
        <p className="m-0 font-mono text-13 font-bold">
          {formatMinute(range.from)}–{formatMinute(range.to % 1440)}
        </p>
        {err("time") ? <p className="m-0 text-12 font-semibold text-danger">{err("time")}</p> : null}
      </fieldset>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3">
        <Field label={t("startsOn")} htmlFor={id("starts")} error={err("dates")}>
          <Input id={id("starts")} type="date" compact value={draft.startsOn} onChange={(e) => set("startsOn", e.target.value)} invalid={Boolean(errors.dates)} />
        </Field>
        <Field label={t("endsOn")} htmlFor={id("ends")}>
          <Input id={id("ends")} type="date" compact value={draft.endsOn} onChange={(e) => set("endsOn", e.target.value)} invalid={Boolean(errors.dates)} />
        </Field>
      </div>
      <Field label={t("terms")} htmlFor={id("terms")} error={err("terms")}>
        <Input id={id("terms")} compact value={draft.terms} onChange={(e) => set("terms", e.target.value)} maxLength={200} />
      </Field>
      {message ? (
        <p role="alert" className="m-0 text-13 font-bold text-danger">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="ink" size="sm" loading={pending} onClick={submit} data-testid="ops-discount-save">
          {submitLabel}
        </Button>
        <Button variant="outline-soft" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

function DiscountItem({ discount, workingHours }: { discount: OpsDiscount; workingHours: string }) {
  const t = useTranslations("adminBusiness.ops");
  const state = useTranslations("adminSuper.discountStatus");
  const failed = useTranslations("adminSuper.errors");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const badge = discountTerms(discount).badge;

  const act = (fn: () => Promise<SuperActionResult>) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? null : failed((r.error ?? "failed") as "failed"));
      router.refresh();
    });

  return (
    <li className="flex flex-col gap-2 border-0 border-b border-solid border-surface py-3" data-testid="ops-discount">
      <div className="flex flex-wrap items-center gap-3">
        {badge ? <DealBadge size="sm">{badge}</DealBadge> : null}
        <span className="min-w-0 flex-1">
          <b className="text-14">{discount.title}</b>
          <div className="text-12 text-muted">
            {discount.startsOn} – {discount.endsOn} · {formatMinute(discount.fromMinute ?? 0)}–{formatMinute((discount.toMinute ?? 0) % 1440)} · {t("daily", { n: discount.dailyLimit ?? 0 })} · {t("sold", { n: discount.sold })}
          </div>
        </span>
        <ToneBadge tone={TONE[discount.status]}>{state(discount.status)}</ToneBadge>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {discount.status === "ACTIVE" || discount.status === "PAUSED" ? (
          <Button variant="outline-soft" size="sm" loading={pending} onClick={() => act(() => setDiscountStatusAdminAction({ discountId: discount.id, active: discount.status === "PAUSED" }))} data-testid="ops-discount-toggle">
            {t(discount.status === "ACTIVE" ? "pause" : "resume")}
          </Button>
        ) : null}
        <Button variant="outline-soft" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="ops-discount-edit">
          {open ? t("close") : t("edit")}
        </Button>
        <Button variant="outline-soft" size="sm" loading={pending} onClick={() => act(() => duplicateDiscountAction({ discountId: discount.id }))} data-testid="ops-discount-copy">
          {t("copy")}
        </Button>
        <ConfirmAction label={t("delete")} confirmText={t("deleteConfirm")} run={() => deleteDiscountAdminAction({ discountId: discount.id })} danger testId="ops-discount-delete" />
      </div>
      {message ? (
        <p role="alert" className="m-0 text-13 font-bold text-danger">
          {message}
        </p>
      ) : null}
      {open ? (
        <DiscountForm
          key={discount.id}
          idPrefix={`d-${discount.id}`}
          initial={discount}
          workingHours={workingHours}
          submitLabel={t("form.save")}
          onCancel={() => setOpen(false)}
          onSubmit={async (draft) => {
            const r = await saveDiscountAdminAction({ discountId: discount.id, draft });
            if (r.ok) {
              setOpen(false);
              router.refresh();
            }
            return r;
          }}
        />
      ) : null}
    </li>
  );
}

/** Biznes kartasidagi "Chegirmalar": ro'yxat (holat, muddat, kunlik son, sotilgan) va admin amallari */
export function DiscountsPanel({ businessId, workingHours, today, discounts }: { businessId: string; workingHours: string; today: string; discounts: OpsDiscount[] }) {
  const t = useTranslations("adminBusiness.ops");
  const hoursT = useTranslations("adminBusiness.hours");
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const labels: HoursLabels = { short: (d) => (hoursT.raw("short") as string[])[d - 1]!, everyDay: hoursT("every") };
  const schedule = parseSchedule(workingHours, labels);
  const initial = emptyDraft(today, schedule ? hoursFor([...DAY_PRESETS.everyDay], schedule) : null);

  return (
    <section className="mt-3 flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5" aria-label={t("discounts.title")} data-testid="ops-discounts">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="m-0 flex-1 text-16 font-extrabold">{t("discounts.title")}</h3>
        <Button variant="ink" size="sm" onClick={() => setCreating((v) => !v)} aria-expanded={creating} data-testid="ops-discount-new">
          {creating ? t("close") : t("discounts.new")}
        </Button>
      </div>
      <p className="m-0 text-13 text-muted">{t("discounts.hint")}</p>
      {creating ? (
        <DiscountForm
          idPrefix="new"
          initial={initial}
          workingHours={workingHours}
          submitLabel={t("form.create")}
          onCancel={() => setCreating(false)}
          onSubmit={async (draft) => {
            const r = await createDiscountForBusinessAction({ businessId, draft });
            if (r.ok) {
              setCreating(false);
              router.refresh();
            }
            return r;
          }}
        />
      ) : null}
      {discounts.length === 0 ? (
        <p className="m-0 text-13 text-muted">{t("discounts.empty")}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {discounts.map((d) => (
            <DiscountItem key={d.id} discount={d} workingHours={workingHours} />
          ))}
        </ul>
      )}
    </section>
  );
}
