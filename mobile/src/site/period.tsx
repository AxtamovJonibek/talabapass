import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import { copy } from "@/copy";
import { colors, font } from "@/theme";
import { Sheet } from "@/ui/app";
import { Press, PrimaryButton, Txt } from "@/ui/kit";
import { SmallChip } from "./time";
import { mono } from "./ui";

/*
 * Chegirma muddati: qo'lda yozilmaydi. Tayyor tanlovlar (Bir hafta, Bir oy, Muddatsiz) yoki "Boshqa sana" —
 * boshlanish va tugash sanasi g'ildiraklari. Tugash doim boshlanishdan keyin (bir kun).
 */

export type Period = { startsOn: string; endsOn: string };

const WEEK = 7;
const MONTH = 30;
/** Server tugash sanasini talab qiladi — "Muddatsiz" uzoq sana sifatida saqlanadi */
export const OPEN_ENDED_DAYS = 3650;

const dayMs = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / dayMs);
export const addDays = (iso: string, days: number) => new Date(toDate(iso).getTime() + days * dayMs).toISOString().slice(0, 10);
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pack = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, daysIn(y, m))).padStart(2, "0")}`;
const show = (iso: string) => iso.split("-").reverse().join(".");

type Preset = "week" | "month" | "open";
const PRESET_DAYS: Record<Preset, number> = { week: WEEK, month: MONTH, open: OPEN_ENDED_DAYS };
const PRESETS: Preset[] = ["week", "month", "open"];

function presetOf(p: Period): Preset | null {
  const span = diffDays(p.startsOn, p.endsOn);
  return PRESETS.find((k) => PRESET_DAYS[k] === span) ?? null;
}

/** Tanlangan muddatning qisqa matni: "13.10.2026 – 20.10.2026 · 7 kun" yoki "13.10.2026 dan · muddatsiz" */
export function periodSummary(p: Period): string {
  const t = copy.biz.editor.periodPicker;
  const span = diffDays(p.startsOn, p.endsOn);
  if (span >= OPEN_ENDED_DAYS) return t.openFrom(show(p.startsOn));
  return `${show(p.startsOn)} – ${show(p.endsOn)} · ${t.days(span)}`;
}

const ITEM = 44;
const VISIBLE = 5;

function Wheel({ options, value, onChange, label, format }: { options: number[]; value: number; onChange: (v: number) => void; label: string; format: (v: number) => string }) {
  const ref = useRef<ScrollViewInstance>(null);
  const index = Math.max(0, options.indexOf(value));
  const last = useRef(index);

  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
    // faqat ochilganda — keyin g'ildirak o'zi boshqaradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tashqaridan qiymat o'zgarsa (masalan, tugash sanasi tuzatilsa) g'ildirak ham siljiydi
  useEffect(() => {
    if (index !== last.current) {
      last.current = index;
      ref.current?.scrollTo({ y: index * ITEM, animated: true });
    }
  }, [index]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(options.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (i !== last.current) {
      last.current = i;
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onChange(options[i]!);
  };

  return (
    <View
      style={styles.wheelBox}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
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
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e);
        }}
        contentContainerStyle={{ paddingVertical: ((VISIBLE - 1) / 2) * ITEM }}
      >
        {options.map((o) => (
          <View key={o} style={styles.wheelItem}>
            <Txt style={[font(o === value ? 900 : 600), styles.wheelText, o === value ? null : styles.wheelDim]}>{format(o)}</Txt>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const two = (n: number) => String(n).padStart(2, "0");

function DateWheels({ value, onChange, minYear, maxYear }: { value: string; onChange: (iso: string) => void; minYear: number; maxYear: number }) {
  const t = copy.biz.editor.periodPicker;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return (
    <View style={styles.wheels}>
      <View style={styles.flex1}>
        <Wheel options={range(1, daysIn(y, m))} value={d} onChange={(v) => onChange(pack(y, m, v))} label={t.day} format={two} />
      </View>
      <View style={styles.flex1}>
        <Wheel options={range(1, 12)} value={m} onChange={(v) => onChange(pack(y, v, d))} label={t.month} format={two} />
      </View>
      <View style={styles.flex1}>
        <Wheel options={range(minYear, maxYear)} value={y} onChange={(v) => onChange(pack(v, m, d))} label={t.year} format={String} />
      </View>
    </View>
  );
}

function PeriodSheetBody({ value, today, onDone }: { value: Period; today: string; onDone: (p: Period) => void }) {
  const t = copy.biz.editor.periodPicker;
  const [draft, setDraft] = useState<Period>(value);
  const [editing, setEditing] = useState<"startsOn" | "endsOn">("startsOn");
  const todayYear = Number(today.slice(0, 4));
  const minYear = Math.min(todayYear, Number(draft.startsOn.slice(0, 4)));
  const maxYear = Math.max(todayYear + 11, Number(draft.endsOn.slice(0, 4)));

  // Tugash sanasi boshlanishdan oldin yoki unga teng bo'lmasin
  const set = (iso: string) =>
    setDraft((p) => {
      if (editing === "startsOn") return { startsOn: iso, endsOn: p.endsOn <= iso ? addDays(iso, 1) : p.endsOn };
      return { startsOn: p.startsOn, endsOn: iso <= p.startsOn ? addDays(p.startsOn, 1) : iso };
    });

  return (
    <>
      <View style={styles.tabs}>
        {(["startsOn", "endsOn"] as const).map((k) => (
          <Press key={k} onPress={() => setEditing(k)} accessibilityRole="button" accessibilityState={{ selected: editing === k }} scale={0.97} style={[styles.tab, editing === k ? styles.tabOn : null]}>
            <Txt style={{ fontSize: 12, color: editing === k ? colors.fog2 : colors.muted }}>{k === "startsOn" ? t.from : t.to}</Txt>
            <Txt style={[mono(700), { fontSize: 16, color: editing === k ? colors.white : colors.ink }]}>{show(draft[k])}</Txt>
          </Press>
        ))}
      </View>
      <DateWheels key={editing} value={draft[editing]} onChange={set} minYear={minYear} maxYear={maxYear} />
      <PrimaryButton icon="tick" onPress={() => onDone(draft)} style={styles.done}>
        {copy.time.done}
      </PrimaryButton>
    </>
  );
}

/** Chegirma muddati maydoni: chiplar + tanlangan natija matni + sana g'ildiraklari oynasi. */
export function PeriodPicker({ value, today, onChange, disabled = false, error }: { value: Period; today: string; onChange: (p: Period) => void; disabled?: boolean; error?: string | null }) {
  const [open, setOpen] = useState(false);
  const t = copy.biz.editor.periodPicker;
  const matched = presetOf(value);
  // Boshlanish o'tmishda bo'lsa (boshlangan chegirma) tayyor tanlov bugundan hisoblanadi
  const base = value.startsOn < today ? today : value.startsOn;
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.wrap}>
        {PRESETS.map((k) => (
          <SmallChip key={k} selected={matched === k} onPress={() => !disabled && onChange({ startsOn: base, endsOn: addDays(base, PRESET_DAYS[k]) })}>
            {t.presets[k]!}
          </SmallChip>
        ))}
        <SmallChip selected={matched === null} onPress={() => !disabled && setOpen(true)}>
          {t.custom}
        </SmallChip>
      </View>
      <Press onPress={() => !disabled && setOpen(true)} accessibilityRole="button" accessibilityLabel={copy.biz.editor.period} scale={0.98} style={[styles.summary, error ? styles.summaryBad : null]}>
        <Txt style={[mono(700), { fontSize: 14 }]}>{periodSummary(value)}</Txt>
      </Press>
      {error ? <Txt style={[font(600), { fontSize: 12, color: colors.danger }]}>{error}</Txt> : null}
      <Sheet visible={open} onClose={() => setOpen(false)} title={t.title}>
        {open ? (
          <PeriodSheetBody
            value={value}
            today={today}
            onDone={(p) => {
              setOpen(false);
              onChange(p);
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summary: { borderRadius: 12, backgroundColor: colors.track, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: "center" },
  summaryBad: { borderWidth: 2, borderColor: colors.danger },
  tabs: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 8 },
  tab: { flex: 1, gap: 2, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 10 },
  tabOn: { backgroundColor: colors.ink },
  wheels: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 12 },
  wheelBox: { height: ITEM * VISIBLE, borderRadius: 18, backgroundColor: colors.white, overflow: "hidden" },
  wheelBand: { position: "absolute", left: 8, right: 8, top: ((VISIBLE - 1) / 2) * ITEM, height: ITEM, borderRadius: 12, backgroundColor: colors.track },
  wheelItem: { height: ITEM, alignItems: "center", justifyContent: "center" },
  wheelText: { fontSize: 22, fontVariant: ["tabular-nums"] },
  wheelDim: { color: colors.muted2 },
  done: { marginHorizontal: 20, marginTop: 16 },
});
