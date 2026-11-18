import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import { copy, copyFor } from "@/copy";
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
  timeOptions,
  timePresetOf,
  uniformHours,
  type DayPreset,
  type HoursLabels,
  type Range,
  type TimePreset,
  type WeekSchedule,
} from "@/lib/hours";
import { colors, font } from "@/theme";
import { Chip, Sheet, Toggle } from "./app";
import { Choice, Note, Press, PrimaryButton, Txt } from "./kit";

/*
 * Vaqt tanlash (saytdagi `components/ui/time-pickers.tsx` bilan bir xil mantiq, `lib/hours.ts`): soat qo'lda yozilmaydi.
 * Kunlar — Du…Ya + "Har kuni" / "Ish kunlari" / "Dam olish kunlari"; vaqt — tayyor oraliqlar yoki "Boshqa vaqt": soat
 * g'ildiragi (30 daqiqa qadam, yarim tundan o'tish bilan).
 */

/** Joriy til belgilari (ekranda) */
export const hoursLabels = (): HoursLabels => ({ short: (d) => copy.weekdaysShort[d - 1]!, everyDay: copy.time.everyDay });
/** Bazaga yoziladigan matn doim o'zbekcha — sayt va talabalar shu matnni o'qiydi */
export const UZ_HOURS_LABELS: HoursLabels = { short: (d) => copyFor("uz").weekdaysShort[d - 1]!, everyDay: copyFor("uz").time.everyDay };

const rangeText = (r: Range) => `${formatMinute(r.from)}–${formatMinute(r.to)}`;

const DAY_ORDER: DayPreset[] = ["everyDay", "workdays", "weekend"];

export function DayChips({ value, onChange, disabled = false }: { value: number[]; onChange: (days: number[]) => void; disabled?: boolean }) {
  const preset = dayPresetOf(value);
  return (
    <View style={styles.gap10}>
      <View style={styles.wrap}>
        {DAY_ORDER.map((p) => (
          <Chip key={p} selected={preset === p} onPress={() => !disabled && onChange([...DAY_PRESETS[p]])}>
            {copy.time.days[p]}
          </Chip>
        ))}
      </View>
      <View style={styles.days}>
        {DAYS.map((d) => {
          const on = value.includes(d);
          return (
            <Choice
              key={d}
              shape="square"
              selected={on}
              label={copy.weekdays[d - 1]}
              onPress={() => !disabled && onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))}
            >
              {copy.weekdaysShort[d - 1]!}
            </Choice>
          );
        })}
      </View>
    </View>
  );
}

const ITEM = 44;
const VISIBLE = 5;

/** Soat g'ildiragi: vertikal ro'yxat, o'rtadagi qator tanlangan (snap), har o'tishda yengil tebranish. */
function Wheel({ options, value, onChange, label }: { options: number[]; value: number; onChange: (m: number) => void; label: string }) {
  const ref = useRef<ScrollViewInstance>(null);
  const index = Math.max(0, options.indexOf(value));
  const last = useRef(index);

  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
    // faqat ochilganda — keyin g'ildirak o'zi boshqaradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(options.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (i !== last.current) {
      last.current = i;
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onChange(options[i]!);
  };

  return (
    <View style={styles.wheelBox} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: formatMinute(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(ev) => {
        const next = Math.min(options.length - 1, Math.max(0, index + (ev.nativeEvent.actionName === "increment" ? 1 : -1)));
        onChange(options[next]!);
        ref.current?.scrollTo({ y: next * ITEM, animated: true });
      }}
    >
      <View pointerEvents="none" style={styles.wheelBand} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          // Inersiyasiz qo'yib yuborilsa ham qiymat olinadi
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e);
        }}
        contentContainerStyle={{ paddingVertical: ((VISIBLE - 1) / 2) * ITEM }}
      >
        {options.map((m) => (
          <View key={m} style={styles.wheelItem}>
            <Txt style={[font(m === value ? 900 : 600), styles.wheelText, m === value ? null : styles.wheelDim]}>{formatMinute(m)}</Txt>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** "Boshqa vaqt": pastdan oyna, ikki g'ildirak (boshlanish / tugash) va "Tayyor". */
export function TimeWheelSheet({ visible, value, onClose, onDone }: { visible: boolean; value: Range; onClose: () => void; onDone: (r: Range) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={copy.time.pickTitle}>
      {/* Har ochilishda joriy qiymatdan boshlanadi */}
      {visible ? <WheelBody value={value} onDone={onDone} /> : null}
    </Sheet>
  );
}

function WheelBody({ value, onDone }: { value: Range; onDone: (r: Range) => void }) {
  const [draft, setDraft] = useState(value);
  const t = copy.time;
  return (
    <>
      <View style={styles.wheels}>
        <View style={styles.flex1}>
          <Txt style={[font(700), styles.wheelLabel]}>{t.from}</Txt>
          <Wheel options={timeOptions("from", draft.from)} value={draft.from} onChange={(from) => setDraft((d) => ({ ...d, from }))} label={t.from} />
        </View>
        <View style={styles.flex1}>
          <Txt style={[font(700), styles.wheelLabel]}>{t.to}</Txt>
          <Wheel options={timeOptions("to", draft.to)} value={draft.to} onChange={(to) => setDraft((d) => ({ ...d, to }))} label={t.to} />
        </View>
      </View>
      {overnight(draft) ? <Note style={styles.note}>{t.overnight(formatMinute(draft.to))}</Note> : null}
      <PrimaryButton icon="tick" onPress={() => onDone(draft)} style={styles.done}>
        {t.done}
      </PrimaryButton>
    </>
  );
}

const TIME_ORDER: TimePreset[] = ["morning", "lunch", "evening", "allDay"];

/** Vaqt oralig'i: tayyor chiplar ("Ish vaqti bo'yicha" — `workHours` bilan) yoki "Boshqa vaqt" (g'ildirak). */
export function TimeRangePicker({ value, onChange, workHours = null, disabled = false }: { value: Range; onChange: (r: Range) => void; workHours?: Range | null; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const t = copy.time;
  const matched: TimePreset | "byHours" | null = workHours && sameRange(workHours, value) ? "byHours" : timePresetOf(value);
  return (
    <View style={styles.gap10}>
      <View style={styles.wrap}>
        {workHours ? (
          <Chip selected={matched === "byHours"} onPress={() => !disabled && onChange(workHours)}>
            {`${t.presets.byHours} · ${rangeText(workHours)}`}
          </Chip>
        ) : null}
        {TIME_ORDER.map((p) => (
          <Chip key={p} selected={matched === p} onPress={() => !disabled && onChange({ ...TIME_PRESETS[p] })}>
            {t.presets[p]}
          </Chip>
        ))}
        <Chip selected={matched === null} onPress={() => !disabled && setOpen(true)}>
          {matched === null ? `${t.presets.custom} · ${rangeText(value)}` : t.presets.custom}
        </Chip>
      </View>
      {overnight(value) ? <Note>{t.overnight(formatMinute(value.to))}</Note> : null}
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

const DEFAULT_HOURS: Range = { from: 9 * 60, to: 21 * 60 };

/**
 * Biznes ish vaqti (ro'yxat, tahrir): "Har kuni bir xil" — kunlar + bitta oraliq; o'chirilsa — har kun alohida
 * (kalit, soatlar) va "Barchasiga nusxalash". `onChange` — bazaga yoziladigan o'zbekcha matn ("Har kuni · 09:00–21:00").
 */
export function WorkingHoursField({ value, onChange, invalid = false }: { value: string; onChange: (text: string) => void; invalid?: boolean }) {
  const t = copy.time;
  const [parsed] = useState(() => parseSchedule(value, UZ_HOURS_LABELS));
  const [schedule, setScheduleState] = useState<WeekSchedule>(parsed ?? scheduleOf(DAY_PRESETS.everyDay, DEFAULT_HOURS));
  const [same, setSame] = useState(parsed ? uniformHours(parsed) : true);
  const [editing, setEditing] = useState<number | null>(null);

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
  const summary = schedule.length ? formatSchedule(schedule, hoursLabels()) : t.summaryEmpty;
  const editingHours = editing ? schedule.find((h) => h.day === editing) : null;

  return (
    <View style={styles.gap12}>
      <Press
        onPress={() => {
          const on = !same;
          setSame(on);
          if (on) setSchedule(scheduleOf(openDays.length ? openDays : DAY_PRESETS.everyDay, common));
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: same }}
        scale={1}
        style={styles.switchRow}
      >
        <Txt style={[font(700), styles.flex1, { fontSize: 15 }]}>{t.sameEveryDay}</Txt>
        <Toggle on={same} size="md" />
      </Press>

      {same ? (
        <>
          <DayChips value={openDays} onChange={(days) => setSchedule(scheduleOf(days, common))} />
          <TimeRangePicker value={common} onChange={(r) => setSchedule(scheduleOf(openDays, r))} />
        </>
      ) : (
        <View style={styles.gap8}>
          {DAYS.map((d) => {
            const hours = schedule.find((h) => h.day === d);
            return (
              <View key={d} style={styles.dayRow}>
                <Press
                  onPress={() => setSchedule(hours ? schedule.filter((h) => h.day !== d) : [...schedule, { day: d, from: common.from, to: common.to }])}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: Boolean(hours) }}
                  accessibilityLabel={copy.weekdays[d - 1]}
                  scale={1}
                  style={styles.dayToggle}
                >
                  <Toggle on={Boolean(hours)} />
                  <Txt style={[font(700), { fontSize: 15 }]}>{copy.weekdays[d - 1]}</Txt>
                </Press>
                {hours ? (
                  <Press onPress={() => setEditing(d)} accessibilityRole="button" style={styles.dayTime}>
                    <Txt style={[font(800), styles.mono]}>{rangeText(hours)}</Txt>
                  </Press>
                ) : (
                  <Txt style={styles.dayOff}>{t.dayOff}</Txt>
                )}
              </View>
            );
          })}
          <Press onPress={() => setSchedule(scheduleOf(openDays, common))} accessibilityRole="button" style={styles.copyAll} disabled={!schedule.length}>
            <Txt style={[font(800), { fontSize: 15, color: colors.rust }]}>{t.copyToAll(rangeText(common))}</Txt>
          </Press>
          <TimeWheelSheet
            visible={editing !== null}
            value={editingHours ?? common}
            onClose={() => setEditing(null)}
            onDone={(r) => {
              const day = editing;
              setEditing(null);
              if (day) setSchedule(schedule.map((h) => (h.day === day ? { day, from: r.from, to: r.to } : h)));
            }}
          />
        </View>
      )}

      <View style={[styles.summary, invalid ? styles.summaryBad : null]} accessibilityLiveRegion="polite">
        <Txt style={[font(800), styles.mono, { color: schedule.length ? colors.ink : colors.muted }]}>{summary}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  days: { flexDirection: "row", gap: 6 },
  wheels: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 8 },
  wheelLabel: { fontSize: 13, color: colors.muted, marginBottom: 6, textAlign: "center" },
  wheelBox: { height: ITEM * VISIBLE, borderRadius: 18, backgroundColor: colors.white, overflow: "hidden" },
  wheelBand: { position: "absolute", left: 8, right: 8, top: ((VISIBLE - 1) / 2) * ITEM, height: ITEM, borderRadius: 12, backgroundColor: colors.track },
  wheelItem: { height: ITEM, alignItems: "center", justifyContent: "center" },
  wheelText: { fontSize: 22, fontVariant: ["tabular-nums"] },
  wheelDim: { color: colors.muted2 },
  note: { marginHorizontal: 20, marginTop: 10 },
  done: { marginHorizontal: 20, marginTop: 16 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.white },
  dayToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  dayTime: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.track, justifyContent: "center" },
  dayOff: { fontSize: 14, color: colors.muted },
  mono: { fontSize: 15, fontVariant: ["tabular-nums"] },
  copyAll: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  summary: { borderRadius: 12, backgroundColor: colors.track, paddingHorizontal: 14, paddingVertical: 10 },
  summaryBad: { borderWidth: 2, borderColor: colors.danger },
});
