"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { DAY_PRESETS, DAYS, formatSchedule, parseSchedule, scheduleOf, timeOptions, type HoursLabels, type Range } from "@/lib/hours";
import { formatMinute } from "@/lib/time";

const DEFAULT_RANGE: Range = { from: 9 * 60, to: 21 * 60 };

/**
 * Ish vaqti (admin kartasi): kunlar (tugmalar) va ochilish/yopilish soati — tanlanadi, yozilmaydi. Bazaga yoziladigan
 * o'zbekcha matn ("Har kuni · 09:00–21:00") yashirin \`workingHours\` maydonida; bir xil soatli jadval qo'llab-quvvatlanadi
 * (kunlar bo'yicha har xil soat — mavjud matn o'zgartirilmaguncha saqlanadi).
 */
export function HoursField({ value, name = "workingHours" }: { value: string; name?: string }) {
  const t = useTranslations("adminBusiness.hours");
  const labels: HoursLabels = { short: (d) => (t.raw("short") as string[])[d - 1]!, everyDay: t("every") };
  const parsed = parseSchedule(value, labels);
  const first = parsed?.[0];
  const uniform = !parsed || parsed.every((h) => h.from === first!.from && h.to === first!.to);
  const [days, setDays] = useState<number[]>(parsed ? parsed.map((h) => h.day) : [...DAY_PRESETS.everyDay]);
  const [range, setRange] = useState<Range>(first ? { from: first.from, to: first.to } : DEFAULT_RANGE);
  const [untouched, setUntouched] = useState(true);

  // Jadval kunlar bo'yicha har xil bo'lsa — tegilmaguncha asl matn qoladi
  const text = !uniform && untouched ? value : days.length ? formatSchedule(scheduleOf(days, range), labels) : "";

  const change = (nextDays: number[], nextRange: Range) => {
    setUntouched(false);
    setDays(nextDays);
    setRange(nextRange);
  };
  const preset = (key: keyof typeof DAY_PRESETS) => change([...DAY_PRESETS[key]], range);
  const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((d) => b.includes(d));

  return (
    <div className="flex flex-col gap-2.5">
      <input type="hidden" name={name} value={text} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("days")}>
        {(["everyDay", "workdays", "weekend"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => preset(k)}
            className={cn("tp-lift h-8 rounded-8 border-hair px-3 text-13 font-semibold", same(days, DAY_PRESETS[k]) ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}
          >
            {t(k === "everyDay" ? "every" : k)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => {
          const on = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => change(on ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b), range)}
              className={cn("tp-lift size-9 rounded-8 border-hair text-13 font-bold", on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}
            >
              {(t.raw("short") as string[])[d - 1]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-13 text-muted">
          {t("from")}
          <Select native compact value={range.from} onChange={(e) => change(days, { ...range, from: Number(e.target.value) })} aria-label={t("from")}>
            {timeOptions("from", range.from).map((m) => (
              <option key={m} value={m}>
                {formatMinute(m)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1.5 text-13 text-muted">
          {t("to")}
          <Select native compact value={range.to} onChange={(e) => change(days, { ...range, to: Number(e.target.value) })} aria-label={t("to")}>
            {timeOptions("to", range.to).map((m) => (
              <option key={m} value={m}>
                {formatMinute(m)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p className="m-0 font-mono text-13 font-bold" data-testid="hours-text">
        {text || t("empty")}
      </p>
    </div>
  );
}
