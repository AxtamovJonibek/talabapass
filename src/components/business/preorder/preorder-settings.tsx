"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatSom } from "@/lib/format";
import { bookingDays, orderAmounts, slotsOn, type DaySchedule, type PreorderSettingsInput } from "@/lib/preorder";
import { formatMinute, parseMinute, toTashkent } from "@/lib/time";
import { savePreorderSettingsAction, setDiscountPreorderAction, setPreorderPausedAction } from "@/server/actions/preorder";
import type { OwnerPreorder } from "@/server/preorder/settings";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
/** "gacha" maydonida 00:00 — kun oxiri (24:00) */
const endMinute = (value: number | null, fallback: number) => (value === 0 ? 1440 : (value ?? fallback));

/** Sozlama bloki: sarlavha, qisqa izoh, boshqaruv. */
function Block({ title, hint, children, aside }: { title: string; hint?: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-18 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="m-0 text-16 font-extrabold">{title}</h3>
          {hint ? <p className="m-0 text-13 leading-[1.4] text-muted">{hint}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function NumberField({ id, label, value, onChange, min, max }: { id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        compact
        tight
        mono={15}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Math.round(Number(e.target.value) || 0))))}
      />
    </Field>
  );
}

/**
 * Biznes → Sozlamalar → "Oldindan band qilish": har band yonida izoh, o'ngda (telefonda pastda) talabaga qanday
 * ko'rinishining jonli preview'i (`src/lib/preorder` dagi bir xil hisob). Chegirmalar belgisi va "Bugun qabul
 * qilmayman" — darhol saqlanadi; qolganlari "Saqlash" bilan. Dizaynda chizilmagan — mavjud primitivlardan.
 */
export function PreorderSettingsForm({ data }: { data: OwnerPreorder }) {
  const t = useTranslations("preorder");
  const tt = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState<PreorderSettingsInput>(data.settings);
  const [paused, setPaused] = useState(data.pausedToday);
  const [discounts, setDiscounts] = useState(data.discounts);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof PreorderSettingsInput>(key: K, value: PreorderSettingsInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const dayRow = (day: number) => form.schedule.find((d) => d.day === day);
  const setDay = (day: number, next: DaySchedule | null) =>
    set("schedule", [...form.schedule.filter((d) => d.day !== day), ...(next ? [next] : [])].sort((a, b) => a.day - b.day));
  const rangeBad = form.schedule.some((d) => d.to <= d.from);

  const save = () =>
    startSaving(async () => {
      setError(null);
      if (rangeBad) return setError(t("errors.range"));
      const result = await savePreorderSettingsAction(form);
      if (result.ok) {
        toast(t("saved"));
        router.refresh();
      } else setError(t(`errors.${result.error}`));
    });

  const togglePause = async (next: boolean) => {
    setPaused(next);
    const result = await setPreorderPausedAction(next);
    if (!result.ok) setPaused(!next);
    else toast(next ? t("paused") : t("resumed"), next ? "info" : "ok");
  };

  const toggleDiscount = async (id: string, on: boolean) => {
    setDiscounts((list) => list.map((d) => (d.id === id ? { ...d, preorder: on } : d)));
    const result = await setDiscountPreorderAction(id, on);
    if (!result.ok) setDiscounts((list) => list.map((d) => (d.id === id ? { ...d, preorder: !on } : d)));
  };

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-3">
        <p className="m-0 text-14 leading-[1.5] text-muted">{t("intro")}</p>
        <p className="m-0 rounded-12 bg-warn-bg px-3.5 py-2.5 text-13 font-semibold text-warn">{t("testMode")}</p>

        <Block title={t("enabled")} hint={t("enabledHint")} aside={<Switch id="preorder-enabled" checked={form.enabled} onChange={(v) => set("enabled", v)} label={t("enabled")} />} />

        <Block
          title={t("pause")}
          hint={t("pauseHint")}
          aside={<Switch id="preorder-paused" checked={paused} onChange={(v) => void togglePause(v)} label={t("pause")} />}
        />

        <Block title={t("discounts")} hint={t("discountsHint")}>
          {discounts.length === 0 ? (
            <p className="m-0 text-14 text-muted">{t("noDiscounts")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {discounts.map((d, i) => (
                <li key={d.id} className={cn("flex min-h-13 items-center gap-3 py-2", i > 0 && "border-0 border-t border-solid border-line-soft")}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-15 font-semibold">{d.title}</span>
                    <span className="font-mono text-12 text-muted">{d.price ? `${formatSom(d.price.final)} ${tt("common.currency")}` : t("noPrice")}</span>
                  </span>
                  <Switch small checked={d.preorder} disabled={!d.price} onChange={(v) => void toggleDiscount(d.id, v)} label={d.title} />
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title={t("mode")} hint={t("modeHint")}>
          <Segmented size="choice" label={t("mode")} value={form.mode} onChange={(v) => set("mode", v)} options={(["PICKUP", "DINE_IN", "BOTH"] as const).map((m) => ({ value: m, label: t(`modes.${m}`) }))} />
        </Block>

        <Block title={t("schedule")} hint={t("scheduleHint")}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {DAYS.map((day) => {
              const row = dayRow(day);
              return (
                <li key={day} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="w-[92px] text-14 font-bold">{tt(`weekday.long.${day}`)}</span>
                  <Switch small checked={Boolean(row)} onChange={(on) => setDay(day, on ? { day, from: 14 * 60, to: 20 * 60 } : null)} label={tt(`weekday.long.${day}`)} />
                  {row ? (
                    <span className="grid min-w-[240px] flex-1 grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5 text-13 text-muted">
                      <Input
                        type="time"
                        step={900}
                        aria-label={`${tt(`weekday.long.${day}`)} ${t("from")}`}
                        compact
                        tight
                        mono={14}
                        className="min-w-0"
                        invalid={row.to <= row.from}
                        value={formatMinute(row.from)}
                        onChange={(e) => setDay(day, { ...row, from: parseMinute(e.target.value) ?? row.from })}
                      />
                      {t("from")}
                      <Input
                        type="time"
                        step={900}
                        aria-label={`${tt(`weekday.long.${day}`)} ${t("to")}`}
                        compact
                        tight
                        mono={14}
                        className="min-w-0"
                        invalid={row.to <= row.from}
                        value={formatMinute(row.to % 1440)}
                        onChange={(e) => setDay(day, { ...row, to: endMinute(parseMinute(e.target.value), row.to) })}
                      />
                      {t("to")}
                    </span>
                  ) : (
                    <span className="text-13 text-muted">{t("closed")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Block>

        <Block title={t("slotMinutes")} hint={t("slotMinutesHint")}>
          <Segmented
            size="choice"
            label={t("slotMinutes")}
            value={String(form.slotMinutes) as "15" | "30" | "60"}
            onChange={(v) => set("slotMinutes", Number(v) as 15 | 30 | 60)}
            options={(["15", "30", "60"] as const).map((m) => ({ value: m, label: t("minutes", { n: m }) }))}
          />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-3">
            <NumberField id="preorder-capacity" label={t("capacity")} value={form.slotCapacity} min={1} max={500} onChange={(v) => set("slotCapacity", v)} />
            <NumberField id="preorder-lead" label={t("lead")} value={form.leadMinutes} min={0} max={1440} onChange={(v) => set("leadMinutes", v)} />
          </div>
          <p className="m-0 text-13 text-muted">
            {t("capacityHint")} {t("leadHint")}
          </p>
        </Block>

        <Block title={t("daysAhead")}>
          <Segmented size="choice" label={t("daysAhead")} value={String(form.daysAhead) as "0" | "1"} onChange={(v) => set("daysAhead", v === "0" ? 0 : 1)} options={(["0", "1"] as const).map((d) => ({ value: d, label: t(`days.${d}`) }))} />
        </Block>

        <Block title={t("prepay")} hint={t("prepayHint")}>
          <Segmented size="choice" label={t("prepay")} value={form.prepay} onChange={(v) => set("prepay", v)} options={(["FULL", "PARTIAL", "NONE"] as const).map((p) => ({ value: p, label: t(`prepayTypes.${p}`) }))} />
          {form.prepay === "PARTIAL" ? <NumberField id="preorder-percent" label={t("prepayPercent")} value={form.prepayPercent} min={1} max={100} onChange={(v) => set("prepayPercent", v)} /> : null}
        </Block>

        <Block title={t("freeCancel")} hint={t("freeCancelHint")}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-3">
            <NumberField id="preorder-free" label={t("freeCancel")} value={form.freeCancelMinutes} min={0} max={1440} onChange={(v) => set("freeCancelMinutes", v)} />
            {form.prepay !== "NONE" ? <NumberField id="preorder-keep" label={t("keep")} value={form.keepPercent} min={0} max={100} onChange={(v) => set("keepPercent", v)} /> : null}
          </div>
          {form.prepay !== "NONE" ? <p className="m-0 text-13 text-muted">{t("keepHint")}</p> : null}
        </Block>

        <Block title={t("confirm")} hint={t("confirmHint")}>
          <Segmented size="choice" label={t("confirm")} value={form.autoConfirm ? "auto" : "manual"} onChange={(v) => set("autoConfirm", v === "auto")} options={(["auto", "manual"] as const).map((c) => ({ value: c, label: t(`confirmModes.${c}`) }))} />
        </Block>

        {error ? (
          <div role="alert" className="rounded-14 bg-danger-bg px-3.5 py-3 text-14 font-semibold text-danger">
            {error}
          </div>
        ) : null}
        <Button variant="orange" size="lg" block loading={saving} onClick={save} data-testid="preorder-save">
          {t("save")}
        </Button>
      </div>

      <aside className="sticky top-5 flex min-w-0 flex-[2_1_300px] flex-col gap-2">
        <h3 className="m-0 font-mono text-11 tracking-[0.1em] text-muted uppercase">{t("preview")}</h3>
        <StudentPreview form={form} paused={paused} sample={discounts.find((d) => d.preorder && d.price) ?? discounts.find((d) => d.price) ?? null} />
      </aside>
    </div>
  );
}

/** Talabaning band qilish oynasi qanday ko'rinadi: usullar, kunlar, birinchi kunning slotlari, narx va qoida. */
function StudentPreview({ form, paused, sample }: { form: PreorderSettingsInput; paused: boolean; sample: OwnerPreorder["discounts"][number] | null }) {
  const t = useTranslations("booking");
  const tp = useTranslations("preorder");
  const tt = useTranslations();
  const now = new Date();
  const config = { ...form, pausedOn: paused ? toTashkent(now).date : null };
  const days = bookingDays(config, now);
  const first = days[0];
  const slots = first ? slotsOn(config, first, now) : [];
  const unit = sample?.price ?? { original: 40_000, final: 30_000 };
  const amounts = orderAmounts(unit, 1, { type: form.prepay, percent: form.prepayPercent });
  const today = toTashkent(now).date.getTime();
  const modes = form.mode === "BOTH" ? (["PICKUP", "DINE_IN"] as const) : [form.mode];

  return (
    <div className={cn("flex flex-col gap-3 rounded-22 border-hair border-line bg-paper p-4", !form.enabled && "opacity-50")} aria-hidden="true">
      <div className="mx-auto h-[5px] w-10 rounded-3 bg-line" />
      <div className="text-18 font-extrabold">{t("title")}</div>
      <div className="flex flex-wrap gap-1.5">
        {modes.map((m) => (
          <span key={m} className="rounded-10 border-hair border-line bg-white px-3 py-1.5 text-13 font-bold">
            {t(`modes.${m}`)}
          </span>
        ))}
      </div>
      {days.length === 0 ? (
        <p className="m-0 text-13 text-muted">{tp("previewEmpty")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {days.map((d) => (
              <span key={d.getTime()} className="rounded-10 bg-white px-3 py-1.5 text-13 font-bold">
                {d.getTime() === today ? t("today") : t("tomorrow")} · {tt(`weekday.short.${d.getUTCDay() === 0 ? 7 : d.getUTCDay()}` as "weekday.short.1")}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {slots.slice(0, 8).map((s) => (
              <span key={s.start.getTime()} className={cn("flex h-11 flex-col items-center justify-center rounded-10 border-hair font-mono text-13 font-semibold", s.late ? "border-line-soft bg-surface text-placeholder" : "border-line bg-white")}>
                {formatMinute(toTashkent(s.start).minute)}
                <span className="font-sans text-10 text-muted">{s.late ? t("late") : t("left", { n: form.slotCapacity })}</span>
              </span>
            ))}
          </div>
        </>
      )}
      <div className="rounded-14 bg-white px-3.5 py-3 font-mono text-13">
        <div className="flex justify-between">
          <span className="font-sans text-muted">{sample?.title ?? t("total")}</span>
          <span>{formatSom(amounts.totalFinal)}</span>
        </div>
        <div className="mt-1 flex justify-between font-sans font-bold">
          <span>{form.prepay === "NONE" ? t("payLater") : t("payNow")}</span>
          <span className="font-mono">{formatSom(form.prepay === "NONE" ? amounts.totalFinal : amounts.prepayAmount)}</span>
        </div>
      </div>
      <p className="m-0 rounded-12 bg-info-bg px-3 py-2.5 text-12 leading-[1.45]">
        {t("freeCancel", { minutes: form.freeCancelMinutes })} {form.prepay === "NONE" ? null : form.keepPercent > 0 ? t("lateKeep", { pct: form.keepPercent }) : t("lateFree")}
        {!form.autoConfirm ? ` ${t("manualConfirm")}` : null}
      </p>
    </div>
  );
}
