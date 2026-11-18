import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { copy } from "@/copy";
import { formatMinute } from "@/lib/format";
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
  timePresetOf,
  uniformHours,
  type DayPreset,
  type Range,
  type TimePreset,
  type WeekSchedule,
} from "@/lib/hours";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";
import { hoursLabels, TimeWheelSheet, UZ_HOURS_LABELS } from "@/ui/time-pickers";
import { SiteSwitch } from "./business";
import { mono, ToggleSquare } from "./ui";

/*
 * Vaqt tanlash — saytdagi `ui/time-pickers.tsx` ko'rinishi (ichki ekranlar: biznes tahriri, chegirma muharriri). Mantiq
 * `lib/hours.ts`; "Boshqa vaqt" — saytda 30 daqiqalik ro'yxat, ilovada shu qiymatlar g'ildirakda (`TimeWheelSheet`).
 * Ro'yxatdan o'tish ekranlari (design/app-flow) `ui/time-pickers.tsx` dagi ilova ko'rinishida qoladi.
 */

/** Saytdagi `Chip size="sm"`: 36px, 13 / 600, tanlangani qora */
export function SmallChip({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} scale={0.96} style={[s.chip, selected ? s.chipOn : null]}>
      <Txt style={[font(600), { fontSize: 13, color: selected ? colors.white : colors.ink }]}>{children}</Txt>
    </Press>
  );
}

const DAY_ORDER: DayPreset[] = ["everyDay", "workdays", "weekend"];

export function DayChips({ value, onChange, error }: { value: number[]; onChange: (days: number[]) => void; error?: string | null }) {
  const preset = dayPresetOf(value);
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <View style={{ gap: 10 }}>
      <View style={s.wrap}>
        {DAY_ORDER.map((p) => (
          <SmallChip key={p} selected={preset === p} onPress={() => onChange([...DAY_PRESETS[p]])}>
            {copy.time.days[p]}
          </SmallChip>
        ))}
      </View>
      <View style={[s.row, { gap: 5 }]}>
        {DAYS.map((d) => (
          <ToggleSquare key={d} bold textSize={13} selected={value.includes(d)} onPress={() => toggle(d)} style={s.flex1}>
            {copy.weekdaysShort[d - 1]!}
          </ToggleSquare>
        ))}
      </View>
      {error ? <Txt style={s.error}>{error}</Txt> : null}
    </View>
  );
}

/** Boshlanish va tugash: saytdagi ro'yxat maydoni ko'rinishida, bosilsa g'ildirak */
export function TimeSelects({ value, onChange, invalid = false }: { value: Range; onChange: (r: Range) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[s.row, { gap: 10 }]}>
      {(["from", "to"] as const).map((kind) => (
        <View key={kind} style={[s.flex1, { gap: 6 }]}>
          <Txt style={[font(600), { fontSize: 13 }]}>{copy.time[kind]}</Txt>
          <Press onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={copy.time[kind]} scale={0.98} style={[s.select, invalid ? { borderColor: colors.danger } : null]}>
            <Txt style={[mono(), { fontSize: 14 }]}>{formatMinute(value[kind])}</Txt>
            <Icon name="chevronDown" size={16} color={colors.muted} />
          </Press>
        </View>
      ))}
      <TimeWheelSheet
        visible={open}
        value={value}
        onClose={() => setOpen(false)}
        onDone={(r) => {
          setOpen(false);
          onChange(r);
        }}
      />
    </View>
  );
}

const TIME_ORDER: TimePreset[] = ["morning", "lunch", "evening", "allDay"];

/** Vaqt oralig'i: tayyor chiplar ("Ish vaqti bo'yicha" — `workHours` berilsa) yoki "Boshqa vaqt" */
export function TimeRangePicker({ value, onChange, workHours = null, invalid = false, error }: { value: Range; onChange: (r: Range) => void; workHours?: Range | null; invalid?: boolean; error?: string | null }) {
  const t = copy.time;
  const matched: TimePreset | "byHours" | null = workHours && sameRange(workHours, value) ? "byHours" : timePresetOf(value);
  const [custom, setCustom] = useState(matched === null);
  const showCustom = custom || matched === null;
  return (
    <View style={{ gap: 10 }}>
      <View style={s.wrap}>
        {workHours ? (
          <SmallChip
            selected={!showCustom && matched === "byHours"}
            onPress={() => {
              setCustom(false);
              onChange(workHours);
            }}
          >
            {`${t.presets.byHours} · ${formatMinute(workHours.from)}–${formatMinute(workHours.to)}`}
          </SmallChip>
        ) : null}
        {TIME_ORDER.map((p) => (
          <SmallChip
            key={p}
            selected={!showCustom && matched === p}
            onPress={() => {
              setCustom(false);
              onChange({ ...TIME_PRESETS[p] });
            }}
          >
            {t.presets[p]}
          </SmallChip>
        ))}
        <SmallChip selected={showCustom} onPress={() => setCustom(true)}>
          {t.presets.custom}
        </SmallChip>
      </View>
      {showCustom ? <TimeSelects value={value} onChange={onChange} invalid={invalid} /> : null}
      {overnight(value) ? <Txt style={[mono(), { fontSize: 12, color: colors.muted }]}>{t.overnight(formatMinute(value.to))}</Txt> : null}
      {error ? <Txt style={s.error}>{error}</Txt> : null}
    </View>
  );
}

const DEFAULT_HOURS: Range = { from: 9 * 60, to: 21 * 60 };

/**
 * Biznes ish vaqti (saytdagi `WorkingHoursField`): "Har kuni bir xil" — kunlar + bitta oraliq; o'chirilsa — har kun alohida
 * va "Barchasiga nusxalash"; pastda jadval matni. `onChange` — bazaga yoziladigan o'zbekcha matn.
 */
export function WorkingHoursField({ value, onChange, error }: { value: string; onChange: (text: string) => void; error?: string | null }) {
  const t = copy.time;
  const [parsed] = useState(() => parseSchedule(value, UZ_HOURS_LABELS));
  const [schedule, setScheduleState] = useState<WeekSchedule>(parsed ?? scheduleOf(DAY_PRESETS.everyDay, DEFAULT_HOURS));
  const [same, setSame] = useState(parsed ? uniformHours(parsed) : true);

  // Birinchi ochilishda standart jadval ham formaga yoziladi (bo'sh qolmasin)
  useEffect(() => {
    if (!parsed) onChange(formatSchedule(schedule, UZ_HOURS_LABELS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSchedule = (next: WeekSchedule) => {
    const sorted = [...next].sort((a, b) => a.day - b.day);
    setScheduleState(sorted);
    onChange(sorted.length ? formatSchedule(sorted, UZ_HOURS_LABELS) : "");
  };
  const first = schedule[0] ?? DEFAULT_HOURS;
  const common: Range = { from: first.from, to: first.to };
  const openDays = schedule.map((h) => h.day);
  const text = schedule.length ? formatSchedule(schedule, hoursLabels()) : "";

  return (
    <View style={{ gap: 12 }}>
      <View style={[s.row, { alignItems: "center", justifyContent: "space-between", gap: 12 }]}>
        <Txt style={[font(600), { fontSize: 14 }]}>{t.sameEveryDay}</Txt>
        <SiteSwitch
          checked={same}
          label={t.sameEveryDay}
          onChange={(on) => {
            setSame(on);
            if (on) setSchedule(scheduleOf(openDays.length ? openDays : DAY_PRESETS.everyDay, common));
          }}
        />
      </View>

      {same ? (
        <>
          <DayChips value={openDays} onChange={(days) => setSchedule(scheduleOf(days, common))} />
          <TimeRangePicker value={common} onChange={(r) => setSchedule(scheduleOf(openDays, r))} />
        </>
      ) : (
        <View style={{ gap: 8 }}>
          {DAYS.map((d) => {
            const hours = schedule.find((h) => h.day === d);
            const name = copy.weekdays[d - 1] ?? "";
            return (
              <View key={d} style={s.dayRow}>
                <View style={[s.row, { height: 48, minWidth: 132, flex: 1, alignItems: "center", gap: 10 }]}>
                  <SiteSwitch
                    small
                    checked={Boolean(hours)}
                    label={name}
                    onChange={(open) => setSchedule(open ? [...schedule, { day: d, from: common.from, to: common.to }] : schedule.filter((h) => h.day !== d))}
                  />
                  <Txt style={[font(600), { fontSize: 14 }]}>{name}</Txt>
                </View>
                {hours ? (
                  <View style={{ minWidth: 220, flex: 2 }}>
                    <TimeSelects value={hours} onChange={(r) => setSchedule(schedule.map((h) => (h.day === d ? { day: d, from: r.from, to: r.to } : h)))} />
                  </View>
                ) : (
                  <View style={{ height: 48, flex: 2, justifyContent: "center" }}>
                    <Txt style={{ fontSize: 13, color: colors.muted }}>{t.dayOff}</Txt>
                  </View>
                )}
              </View>
            );
          })}
          <Press onPress={() => setSchedule(scheduleOf(openDays, common))} disabled={!schedule.length} accessibilityRole="button" scale={0.98} style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}>
            <Txt style={[font(700), { fontSize: 14, color: colors.rust }]}>{t.copyToAll(`${formatMinute(common.from)}–${formatMinute(common.to)}`)}</Txt>
          </Press>
        </View>
      )}

      <View style={s.summary} accessibilityLiveRegion="polite">
        <Txt style={[mono(600), { fontSize: 13, color: text ? colors.ink : colors.muted }]}>{text || t.summaryEmpty}</Txt>
      </View>
      {error ? <Txt style={s.error}>{error}</Txt> : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  select: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, padding: 10 },
  summary: { borderRadius: 10, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8 },
  error: { ...font(600), fontSize: 12, color: colors.danger },
});
