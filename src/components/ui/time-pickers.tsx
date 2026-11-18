"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DAY_PRESETS,
  DAYS,
  dayPresetOf,
  formatSchedule,
  overnight,
  parseSchedule,
  sameRange,
  scheduleOf,
  TIME_PRESETS,
  timeOptions,
  timePresetOf,
  uniformHours,
  type DayPreset,
  type HoursLabels,
  type Range,
  type TimePreset,
  type WeekSchedule,
} from "@/lib/hours";
import { cn } from "@/lib/cn";
import { formatMinute } from "@/lib/time";
import { Chip, ToggleSquare } from "./chip";
import { Select } from "./field";
import { Switch } from "./switch";

/*
 * Vaqt tanlash primitivlari (dizaynda chizilmagan — mavjud Chip, ToggleSquare, Select, Switch dan): soatni qo'lda yozish yo'q.
 * Kunlar — Du…Ya chiplari + "Har kuni" / "Ish kunlari" / "Dam olish kunlari"; vaqt — tayyor oraliqlar + "Boshqa vaqt"
 * (30 daqiqa qadamli ro'yxat, yarim tundan o'tish bilan). Mantiq — `src/lib/hours.ts`.
 */

/** "Du" … "Ya" va "Har kuni" — `formatSchedule` / `daysText` uchun (messages/uz.json `weekday`). */
export function useHoursLabels(): HoursLabels {
  const weekday = useTranslations("weekday");
  return { short: (d) => weekday(`short.${d}` as "short.1"), everyDay: weekday("everyDay") };
}

const PRESET_ORDER: DayPreset[] = ["everyDay", "workdays", "weekend"];

/** Hafta kunlari chiplari va tez tanlov. `size`: telefon (B2) yoki veb (WB2) — ToggleSquare o'lchami. */
export function DayChips({ value, onChange, size = "phone", error }: { value: number[]; onChange: (days: number[]) => void; size?: "phone" | "web"; error?: string | null }) {
  const t = useTranslations("timePicker");
  const weekday = useTranslations("weekday");
  const preset = dayPresetOf(value);
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("quickDays")}>
        {PRESET_ORDER.map((p) => (
          <Chip key={p} size="sm" selected={preset === p} onClick={() => onChange([...DAY_PRESETS[p]])}>
            {t(`days.${p}`)}
          </Chip>
        ))}
      </div>
      <div className={cn("grid grid-cols-7", size === "phone" ? "gap-[5px]" : "max-w-[520px] gap-1.5")}>
        {DAYS.map((d) => (
          <ToggleSquare key={d} day tall={size === "web"} textSize={size === "phone" ? 13 : 14} selected={value.includes(d)} onClick={() => toggle(d)} aria-label={weekday(`long.${d}` as "long.1")}>
            {weekday(`short.${d}` as "short.1")}
          </ToggleSquare>
        ))}
      </div>
      {error ? <p className="m-0 text-12 font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

const TIME_ORDER: TimePreset[] = ["morning", "lunch", "evening", "allDay"];

/** Boshlanish va tugash — 30 daqiqa qadamli ro'yxatlar. */
export function TimeSelects({ value, onChange, idPrefix, invalid = false, compact = true }: { value: Range; onChange: (r: Range) => void; idPrefix: string; invalid?: boolean; compact?: boolean }) {
  const t = useTranslations("timePicker");
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {(["from", "to"] as const).map((kind) => (
        <label key={kind} htmlFor={`${idPrefix}-${kind}`} className="flex min-w-0 flex-col gap-1.5 text-13 font-semibold">
          {t(kind)}
          <Select
            native
            compact={compact}
            id={`${idPrefix}-${kind}`}
            value={value[kind]}
            invalid={invalid}
            onChange={(e) => onChange({ ...value, [kind]: Number(e.target.value) })}
            className="font-mono tabular-nums"
          >
            {timeOptions(kind, value[kind]).map((m) => (
              <option key={m} value={m}>
                {formatMinute(m)}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </div>
  );
}

/**
 * Vaqt oralig'i: tayyor chiplar ("Ish vaqti bo'yicha" — `workHours` berilsa) yoki "Boshqa vaqt" — ro'yxatlar.
 * Qiymat tayyorlardan biriga to'g'ri kelmasa "Boshqa vaqt" ochiq turadi.
 */
export function TimeRangePicker({
  value,
  onChange,
  workHours = null,
  idPrefix,
  invalid = false,
  error,
}: {
  value: Range;
  onChange: (r: Range) => void;
  workHours?: Range | null;
  idPrefix: string;
  invalid?: boolean;
  error?: string | null;
}) {
  const t = useTranslations("timePicker");
  const matched: TimePreset | "byHours" | null = workHours && sameRange(workHours, value) ? "byHours" : timePresetOf(value);
  const [custom, setCustom] = useState(matched === null);
  const showCustom = custom || matched === null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("quickTime")}>
        {workHours ? (
          <Chip size="sm" selected={!showCustom && matched === "byHours"} onClick={() => {
              setCustom(false);
              onChange(workHours);
            }}>
            {t("presets.byHours")} · {formatMinute(workHours.from)}–{formatMinute(workHours.to)}
          </Chip>
        ) : null}
        {TIME_ORDER.map((p) => (
          <Chip key={p} size="sm" selected={!showCustom && matched === p} onClick={() => {
              setCustom(false);
              onChange({ ...TIME_PRESETS[p] });
            }}>
            {t(`presets.${p}`)}
          </Chip>
        ))}
        <Chip size="sm" selected={showCustom} onClick={() => setCustom(true)}>
          {t("presets.custom")}
        </Chip>
      </div>
      {showCustom ? <TimeSelects value={value} onChange={onChange} idPrefix={idPrefix} invalid={invalid} /> : null}
      {overnight(value) ? <p className="m-0 font-mono text-12 text-muted">{t("overnight", { time: formatMinute(value.to) })}</p> : null}
      {error ? <p className="m-0 text-12 font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

const DEFAULT_HOURS: Range = { from: 9 * 60, to: 21 * 60 };

/**
 * Biznes ish vaqti (B1/WB1, profil tahriri): "Har kuni bir xil" — kunlar + bitta oraliq; o'chirilsa — har kun alohida
 * (ochiq/dam olish, soatlar) va "Barchasiga nusxalash". Formaga `name` bilan yig'ilgan matn ketadi
 * ("Har kuni · 09:00–21:00") — server uni `Business.workingHours` ga yozadi, keyingi ochilishda `parseSchedule` tiklaydi.
 */
export function WorkingHoursField({
  name,
  initial,
  idPrefix,
  error,
  onChange,
}: {
  name: string;
  /** Saqlangan matn (`Business.workingHours`); o'qib bo'lmasa — standart jadval */
  initial: string;
  idPrefix: string;
  error?: string | null;
  onChange?: (text: string) => void;
}) {
  const t = useTranslations("timePicker");
  const weekday = useTranslations("weekday");
  const labels = useHoursLabels();
  const [parsed] = useState(() => parseSchedule(initial, labels));
  const [schedule, setScheduleState] = useState<WeekSchedule>(parsed ?? scheduleOf(DAY_PRESETS.everyDay, DEFAULT_HOURS));
  const [same, setSame] = useState(parsed ? uniformHours(parsed) : true);
  const text = schedule.length ? formatSchedule(schedule, labels) : "";

  const setSchedule = (next: WeekSchedule) => {
    const sorted = [...next].sort((a, b) => a.day - b.day);
    setScheduleState(sorted);
    onChange?.(sorted.length ? formatSchedule(sorted, labels) : "");
  };
  const first = schedule[0] ?? DEFAULT_HOURS;
  const common: Range = { from: first.from, to: first.to };
  const openDays = schedule.map((h) => h.day);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={text} />
      <label className="flex items-center justify-between gap-3 text-14 font-semibold">
        {t("sameEveryDay")}
        <Switch
          checked={same}
          label={t("sameEveryDay")}
          onChange={(on) => {
            setSame(on);
            // Bir xilga o'tishda — birinchi ochiq kunning soati hammaga
            if (on) setSchedule(scheduleOf(openDays.length ? openDays : DAY_PRESETS.everyDay, common));
          }}
        />
      </label>

      {same ? (
        <>
          <DayChips value={openDays} onChange={(days) => setSchedule(scheduleOf(days, common))} />
          <TimeRangePicker idPrefix={idPrefix} value={common} onChange={(r) => setSchedule(scheduleOf(openDays, r))} />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {DAYS.map((d) => {
            const hours = schedule.find((h) => h.day === d);
            return (
              <div key={d} className="flex flex-wrap items-end gap-2.5 rounded-12 border-hair border-line bg-white p-2.5">
                <label className="flex h-12 min-w-[132px] flex-1 items-center gap-2.5 text-14 font-semibold">
                  <Switch
                    small
                    checked={Boolean(hours)}
                    label={weekday(`long.${d}` as "long.1")}
                    onChange={(open) => setSchedule(open ? [...schedule, { day: d, from: common.from, to: common.to }] : schedule.filter((h) => h.day !== d))}
                  />
                  {weekday(`long.${d}` as "long.1")}
                </label>
                {hours ? (
                  <div className="min-w-[220px] flex-[2]">
                    <TimeSelects idPrefix={`${idPrefix}-${d}`} value={hours} onChange={(r) => setSchedule(schedule.map((h) => (h.day === d ? { day: d, from: r.from, to: r.to } : h)))} />
                  </div>
                ) : (
                  <span className="flex h-12 flex-[2] items-center text-13 text-muted">{t("dayOff")}</span>
                )}
              </div>
            );
          })}
          <button
            type="button"
            disabled={!schedule.length}
            onClick={() => setSchedule(scheduleOf(openDays, common))}
            className="tp-link self-start border-0 bg-transparent p-0 font-sans text-14 font-bold text-rust disabled:opacity-50"
          >
            {t("copyToAll", { hours: `${formatMinute(common.from)}–${formatMinute(common.to)}` })}
          </button>
        </div>
      )}

      <p className={cn("m-0 rounded-10 bg-surface px-3 py-2 font-mono text-13 font-semibold", text ? "text-ink" : "text-muted")} aria-live="polite">
        {text || t("summaryEmpty")}
      </p>
      {error ? <p className="m-0 text-12 font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
