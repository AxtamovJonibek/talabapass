import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "@/api/client";
import {
  bizApi,
  BOOKING_LIMITS,
  type BookingKind,
  type BookingPreview,
  type DaySchedule,
  type DiscountBooking,
  type OwnerPreorder,
  type PreorderDiscount,
  type PreorderSettings,
} from "@/api/business";
import { copy } from "@/copy";
import { formatMinute, formatSom, toTashkent } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { SiteSwitch } from "@/site/business";
import { BackText, Button, Choice, mono, SiteField, SiteInput } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { Icon, type IconName } from "@/ui/icons";
import { KEYBOARD_GAP, Press, Txt } from "@/ui/kit";
import { TimeWheelSheet } from "@/ui/time-pickers";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const KINDS: BookingKind[] = ["APPOINTMENT", "PREPAID_PICKUP", "PICKUP_WINDOW"];
const KIND_ICON: Record<BookingKind, IconName> = { APPOINTMENT: "cut", PREPAID_PICKUP: "book", PICKUP_WINDOW: "bowl" };
const PREVIEW_DELAY_MS = 300;

/**
 * Sozlamalar → "Oldindan band qilish" — saytdagi `/biznes/sozlamalar` (`PreorderSettingsForm`) telefon ko'rinishi: yoqish,
 * "Bugun qabul qilmayman" (darhol), chegirmalar va har birining rejimi (3 karta, maydonlar, "Saqlash"), umumiy qoidalar
 * (ish jadvali, tayyorlash vaqti, qachongacha, to'lov, bekor qilish, tasdiqlash) va pastda talabaga ko'rinishi (jonli
 * preview — hisob serverda, `POST /business/preorder/preview`). Vaqt — g'ildirak (saytda vaqt maydoni).
 */
export default function Settings() {
  const insets = useSafeAreaInsets();
  const data = useLoad(useCallback(() => bizApi.preorder(), []), true, "biz.preorder");
  const { refresh } = data;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}
      bottomOffset={KEYBOARD_GAP}
      keyboardShouldPersistTaps="handled"
    >
      <BackText label={copy.back} onPress={() => router.navigate("/panel/orders")} style={styles.back} />
      <View style={{ gap: 4 }}>
        <Txt accessibilityRole="header" style={[font(900, 110), styles.title]}>
          {copy.biz.settings.title}
        </Txt>
        <Txt style={[font(800, 110), { fontSize: 18, marginTop: 8 }]}>{copy.biz.settings.section}</Txt>
      </View>
      {/* Yuklangandan keyin forma o'z holatida — qayta yuklash kiritilganni o'chirmasin */}
      {data.data ? <Form key={data.data.businessId} data={data.data} /> : data.loading ? <Loading /> : <Failed error={data.error ?? copy.unknownError} onRetry={() => void data.reload()} />}
    </KeyboardAwareScrollView>
  );
}

function Block({ title, hint, aside, children }: { title: string; hint?: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <View style={styles.block}>
      <View style={[styles.row, { alignItems: "flex-start", justifyContent: "space-between", gap: 12 }]}>
        <View style={[styles.flex1, { gap: 4 }]}>
          <Txt style={[font(800), { fontSize: 16 }]}>{title}</Txt>
          {hint ? <Txt style={styles.hint}>{hint}</Txt> : null}
        </View>
        {aside}
      </View>
      {children}
    </View>
  );
}

function NumberField({ label, value, onChange, min, max, style }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; style?: object }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  // Tashqaridan o'zgarsa (masalan, rejim almashganda) — maydon ham yangilanadi
  if (prev !== value) {
    setPrev(value);
    setText(String(value));
  }
  return (
    <SiteField label={label} style={style}>
      <SiteInput
        mono
        compact
        keyboardType="number-pad"
        value={text}
        onChangeText={(t) => {
          setText(t.replace(/\D/g, ""));
          const n = Math.min(max, Math.max(min, Math.round(Number(t.replace(/\D/g, "")) || 0)));
          onChange(n);
        }}
        onBlur={() => setText(String(value))}
        style={{ paddingHorizontal: 12 }}
      />
    </SiteField>
  );
}

/** "14:00 dan — 20:00 gacha": ikki vaqt katagi, bosilsa g'ildirak (30 daqiqa) */
function TimeRange({ from, to, onChange }: { from: number; to: number; onChange: (from: number, to: number) => void }) {
  const t = copy.biz.settings;
  const [open, setOpen] = useState(false);
  const bad = to <= from;
  const box = (minute: number) => (
    <Press onPress={() => setOpen(true)} accessibilityRole="button" scale={0.98} style={[styles.timeBox, bad ? { borderColor: colors.danger } : null]}>
      <Txt style={[mono(), { fontSize: 14 }]}>{formatMinute(minute % 1440)}</Txt>
    </Press>
  );
  return (
    <View style={[styles.row, styles.flex1, { alignItems: "center", gap: 6 }]}>
      {box(from)}
      <Txt style={styles.hint}>{t.from}</Txt>
      {box(to)}
      <Txt style={styles.hint}>{t.to}</Txt>
      <TimeWheelSheet
        visible={open}
        value={{ from, to: to % 1440 }}
        onClose={() => setOpen(false)}
        onDone={(r) => {
          setOpen(false);
          onChange(r.from, r.to === 0 ? 1440 : r.to);
        }}
      />
    </View>
  );
}

function Notice({ tone, children, testID }: { tone: "warn" | "danger" | "ok"; children: string; testID?: string }) {
  const bg = tone === "warn" ? colors.warnBg : tone === "danger" ? colors.dangerBg : colors.greenBg;
  const fg = tone === "warn" ? colors.warn : tone === "danger" ? colors.danger : colors.greenSite;
  return (
    <View testID={testID} accessibilityRole={tone === "danger" ? "alert" : undefined} style={[styles.notice, { backgroundColor: bg }]}>
      <Txt style={[font(600), { fontSize: 13, color: fg }]}>{children}</Txt>
    </View>
  );
}

function Form({ data }: { data: OwnerPreorder }) {
  const t = copy.biz.settings;
  const [form, setForm] = useState<PreorderSettings>(data.settings);
  const [paused, setPaused] = useState(data.pausedToday);
  const [discounts, setDiscounts] = useState(data.discounts);
  const [drafts, setDrafts] = useState<Record<string, DiscountBooking>>(() => Object.fromEntries(data.discounts.map((d) => [d.id, d.booking])));
  const [editing, setEditing] = useState<string | null>(() => (data.discounts.find((d) => d.booking.bookingMode !== "NONE") ?? data.discounts.find((d) => d.price))?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<BookingPreview | null>(null);
  const set = <K extends keyof PreorderSettings>(key: K, value: PreorderSettings[K]) => setForm((f) => ({ ...f, [key]: value }));

  const dayRow = (day: number) => form.schedule.find((d) => d.day === day);
  const setDay = (day: number, next: DaySchedule | null) => set("schedule", [...form.schedule.filter((d) => d.day !== day), ...(next ? [next] : [])].sort((a, b) => a.day - b.day));
  const rangeBad = form.schedule.some((d) => d.to <= d.from);
  const noneMarked = form.enabled && !discounts.some((d) => d.booking.bookingMode !== "NONE" && d.price);
  const editingDiscount = discounts.find((d) => d.id === editing) ?? null;
  const draft = editingDiscount ? (drafts[editingDiscount.id] ?? editingDiscount.booking) : null;

  // Jonli preview (saqlanmagan o'zgarishlar bilan) — server hisoblaydi, yozish to'xtaganda
  useEffect(() => {
    if (!editingDiscount || !draft || rangeBad || draft.windowTo <= draft.windowFrom) return;
    let live = true;
    const id = setTimeout(() => {
      bizApi.previewBooking({ settings: form, paused, discountId: editingDiscount.id, draft }).then(
        (p) => live && setPreview(p),
        () => undefined,
      );
    }, PREVIEW_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [form, paused, editingDiscount, draft, rangeBad]);

  const save = async () => {
    setError(null);
    setNotice(null);
    if (rangeBad) return setError(t.range);
    setSaving(true);
    try {
      await bizApi.savePreorder(form);
      setNotice(t.saved);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async (next: boolean) => {
    setPaused(next);
    try {
      await bizApi.pausePreorder(next);
      setNotice(next ? t.paused : t.resumed);
    } catch {
      setPaused(!next);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 12 }}>
        <Txt style={{ fontSize: 14, lineHeight: 21, color: colors.muted }}>{t.intro}</Txt>
        <Notice tone="warn">{t.testMode}</Notice>

        <Block title={t.enabled} hint={t.enabledHint} aside={<SiteSwitch checked={form.enabled} onChange={(v) => set("enabled", v)} label={t.enabled} />} />
        <Block title={t.pause} hint={t.pauseHint} aside={<SiteSwitch checked={paused} onChange={(v) => void togglePause(v)} label={t.pause} />} />

        <Block title={t.discounts} hint={t.discountsHint}>
          {noneMarked ? (
            <Notice tone="warn" testID="preorder-none-marked">
              {t.noneMarked}
            </Notice>
          ) : null}
          {discounts.length === 0 ? (
            <Txt style={{ fontSize: 14, color: colors.muted }}>{t.noDiscounts}</Txt>
          ) : (
            <View>
              {discounts.map((d, i) => {
                const open = editing === d.id;
                return (
                  <View key={d.id} testID="preorder-discount" style={[styles.discount, i > 0 ? styles.discountLine : null]}>
                    <View style={[styles.row, { minHeight: 44, alignItems: "center", gap: 12 }]}>
                      <View style={styles.flex1}>
                        <Txt numberOfLines={1} style={[font(600), { fontSize: 15 }]}>
                          {d.title}
                        </Txt>
                        <Txt style={[mono(), { fontSize: 12, color: colors.muted }]}>
                          {`${d.price ? `${formatSom(d.price.final)} ${copy.currency}` : t.noPrice} · `}
                          <Txt style={d.booking.bookingMode === "NONE" ? [mono(), { fontSize: 12, color: colors.muted }] : [font(700), { fontSize: 12, color: colors.ink }]}>{t.kindShort[d.booking.bookingMode]}</Txt>
                        </Txt>
                      </View>
                      <Button
                        variant="outline-soft"
                        size="sm"
                        disabled={!d.price}
                        onPress={() => {
                          setPreview(null);
                          setEditing(open ? null : d.id);
                        }}
                      >
                        {open ? t.close : t.configure}
                      </Button>
                    </View>
                    {open ? (
                      <BookingEditor
                        discount={d}
                        draft={drafts[d.id] ?? d.booking}
                        offHours={preview?.offHours ?? false}
                        onChange={(next) => setDrafts((all) => ({ ...all, [d.id]: next }))}
                        onSaved={(booking) => setDiscounts((list) => list.map((x) => (x.id === d.id ? { ...x, booking } : x)))}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </Block>

        <Txt style={[font(800), { fontSize: 18, marginTop: 8, paddingHorizontal: 4 }]}>{t.general}</Txt>

        <Block title={t.schedule} hint={t.scheduleHint}>
          <View style={{ gap: 8 }}>
            {DAYS.map((day) => {
              const row = dayRow(day);
              const name = copy.weekdays[day - 1] ?? "";
              return (
                <View key={day} style={[styles.row, { flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 8 }]}>
                  <Txt style={[font(700), { fontSize: 14, width: 92 }]}>{name}</Txt>
                  <SiteSwitch small checked={Boolean(row)} onChange={(on) => setDay(day, on ? { day, from: 14 * 60, to: 20 * 60 } : null)} label={name} />
                  {row ? (
                    <View style={{ minWidth: 240, flex: 1, flexDirection: "row" }}>
                      <TimeRange from={row.from} to={row.to} onChange={(from, to) => setDay(day, { ...row, from, to })} />
                    </View>
                  ) : (
                    <Txt style={styles.hint}>{t.closed}</Txt>
                  )}
                </View>
              );
            })}
          </View>
        </Block>

        <Block title={t.lead} hint={t.leadHint}>
          <NumberField label={t.leadMinutes} value={form.leadMinutes} min={0} max={1440} onChange={(v) => set("leadMinutes", v)} />
        </Block>

        <Block title={t.daysAhead} hint={t.daysAheadHint}>
          <Choice label={t.daysAhead} value={form.daysAhead} onChange={(v) => set("daysAhead", v)} options={([0, 1] as const).map((d) => ({ value: d, label: t.days[d] ?? "" }))} />
        </Block>

        <Block title={t.prepay} hint={t.prepayHint}>
          <Choice label={t.prepay} value={form.prepay} onChange={(v) => set("prepay", v)} options={(["FULL", "PARTIAL", "NONE"] as const).map((p) => ({ value: p, label: t.prepayTypes[p] ?? p }))} />
          {form.prepay === "PARTIAL" ? <NumberField label={t.prepayPercent} value={form.prepayPercent} min={1} max={100} onChange={(v) => set("prepayPercent", v)} /> : null}
        </Block>

        <Block title={t.freeCancel} hint={t.freeCancelHint}>
          <View style={[styles.row, { flexWrap: "wrap", gap: 12 }]}>
            <NumberField label={t.freeCancel} value={form.freeCancelMinutes} min={0} max={1440} onChange={(v) => set("freeCancelMinutes", v)} style={styles.field} />
            {form.prepay !== "NONE" ? <NumberField label={t.keep} value={form.keepPercent} min={0} max={100} onChange={(v) => set("keepPercent", v)} style={styles.field} /> : null}
          </View>
          {form.prepay !== "NONE" ? <Txt style={styles.hint}>{t.keepHint}</Txt> : null}
        </Block>

        <Block title={t.confirm} hint={t.confirmHint}>
          <Choice
            label={t.confirm}
            value={form.autoConfirm ? "auto" : "manual"}
            onChange={(v) => set("autoConfirm", v === "auto")}
            options={(["auto", "manual"] as const).map((c) => ({ value: c, label: t.confirmModes[c] ?? c }))}
          />
        </Block>

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="ok">{notice}</Notice> : null}
        <Button variant="orange" size="lg" block busy={saving} disabled={saving} onPress={() => void save()}>
          {t.save}
        </Button>
      </View>

      <View style={{ gap: 8 }}>
        <Txt style={[mono(), { fontSize: 11, letterSpacing: em(11, 0.1), color: colors.muted }]}>{t.preview.toUpperCase()}</Txt>
        <StudentPreview settings={form} discount={editingDiscount} draft={draft} preview={preview} />
      </View>
    </View>
  );
}

/** Bir chegirmaning rejimi: 3 karta (misollar bilan), faqat tanlangan rejim maydonlari, "Saqlash" */
function BookingEditor({
  discount,
  draft,
  offHours,
  onChange,
  onSaved,
}: {
  discount: PreorderDiscount;
  draft: DiscountBooking;
  offHours: boolean;
  onChange: (next: DiscountBooking) => void;
  onSaved: (booking: DiscountBooking) => void;
}) {
  const t = copy.biz.settings;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof DiscountBooking>(key: K, value: DiscountBooking[K]) => onChange({ ...draft, [key]: value });
  const mode = draft.bookingMode;
  const hours = `${formatMinute(discount.schedule.fromMinute)}–${formatMinute(discount.schedule.toMinute % 1440)}`;
  const keepRule = draft.expireKeepPercent === 0 ? "refund" : draft.expireKeepPercent >= 100 ? "none" : "partial";
  const L = BOOKING_LIMITS;

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await bizApi.saveBooking(discount.id, draft);
      onSaved(draft);
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID="booking-editor" style={styles.editor}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t.discounts} style={{ gap: 8 }}>
        {KINDS.map((kind) => {
          const selected = mode === kind;
          return (
            <Press
              key={kind}
              testID={`kind-${kind}`}
              onPress={() => set("bookingMode", kind)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              scale={0.98}
              style={[styles.kind, { borderColor: selected ? colors.ink : colors.line }]}
            >
              <View style={[styles.row, { alignSelf: "stretch", alignItems: "center", justifyContent: "space-between" }]}>
                <Icon name={KIND_ICON[kind]} size={22} />
                <View style={[styles.radio, selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : null]}>
                  {selected ? <Icon name="check" size={12} color={colors.white} strokeWidth={3} /> : null}
                </View>
              </View>
              <Txt style={[font(800), { fontSize: 15 }]}>{t.kinds[kind]?.title}</Txt>
              <Txt style={{ fontSize: 12, lineHeight: 16, color: colors.muted }}>{t.kinds[kind]?.example}</Txt>
            </Press>
          );
        })}
      </View>

      {mode === "NONE" ? (
        <Txt style={styles.hint}>{t.kindNone}</Txt>
      ) : (
        <>
          <Txt style={styles.hint}>{t.kinds[mode]?.hint}</Txt>
          <View style={[styles.row, { flexWrap: "wrap", gap: 12 }]}>
            {mode === "APPOINTMENT" ? (
              <>
                <NumberField label={t.serviceMinutes} value={draft.serviceMinutes} min={L.serviceMin} max={L.serviceMax} onChange={(v) => set("serviceMinutes", v)} style={styles.field} />
                <NumberField label={t.staffCount} value={draft.staffCount} min={1} max={L.staffMax} onChange={(v) => set("staffCount", v)} style={styles.field} />
              </>
            ) : mode === "PREPAID_PICKUP" ? (
              <>
                <NumberField label={t.validDays} value={draft.validDays} min={1} max={L.validDaysMax} onChange={(v) => set("validDays", v)} style={styles.field} />
                <NumberField label={t.stock} value={draft.stock} min={0} max={100_000} onChange={(v) => set("stock", v)} style={styles.field} />
                <NumberField label={t.perStudentMax} value={draft.perStudentMax} min={1} max={L.perStudentMax} onChange={(v) => set("perStudentMax", v)} style={styles.field} />
              </>
            ) : (
              <>
                <NumberField label={t.windowCapacity} value={draft.windowCapacity} min={1} max={500} onChange={(v) => set("windowCapacity", v)} style={styles.field} />
                <NumberField label={t.perStudentMax} value={draft.perStudentMax} min={1} max={L.perStudentMax} onChange={(v) => set("perStudentMax", v)} style={styles.field} />
              </>
            )}
          </View>
          {mode === "APPOINTMENT" ? <Txt style={styles.hint}>{t.appointmentFieldsHint}</Txt> : null}
          {mode === "PICKUP_WINDOW" ? (
            <View style={{ gap: 6 }}>
              <View style={[styles.row, { alignItems: "baseline", justifyContent: "space-between", gap: 8 }]}>
                <Txt style={[font(600), { fontSize: 13 }]}>{t.window}</Txt>
                <Txt style={[mono(), { fontSize: 11, color: colors.muted }]}>{t.windowHint}</Txt>
              </View>
              <View style={styles.row}>
                <TimeRange from={draft.windowFrom} to={draft.windowTo} onChange={(from, to) => onChange({ ...draft, windowFrom: from, windowTo: to })} />
              </View>
            </View>
          ) : null}
          {mode === "PREPAID_PICKUP" ? (
            <View style={{ gap: 8 }}>
              <Txt style={[font(700), { fontSize: 13 }]}>{t.expireRule}</Txt>
              <Choice
                label={t.expireRule}
                value={keepRule}
                onChange={(v) => set("expireKeepPercent", v === "refund" ? 0 : v === "none" ? 100 : 50)}
                options={(["refund", "partial", "none"] as const).map((r) => ({ value: r, label: t.expireRules[r] ?? r }))}
              />
              {keepRule === "partial" ? <NumberField label={t.expireKeep} value={draft.expireKeepPercent} min={1} max={99} onChange={(v) => set("expireKeepPercent", v)} /> : null}
              <Txt style={styles.hint}>{t.expireHint}</Txt>
            </View>
          ) : null}
          {offHours ? (
            <Notice tone="warn" testID="preorder-off-hours">
              {mode === "APPOINTMENT" ? t.offHours(hours) : t.offHoursWindow(hours)}
            </Notice>
          ) : null}
        </>
      )}

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {saved ? <Notice tone="ok">{t.discountSaved}</Notice> : null}
      <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
        <Button variant="orange" size="md" block busy={saving} disabled={saving} onPress={() => void save()} style={styles.flex1}>
          {t.discountSave}
        </Button>
        {mode !== "NONE" ? (
          <Button variant="outline-soft" size="md" onPress={() => set("bookingMode", "NONE")}>
            {t.kindOff}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

/** Talabaning band qilish oynasi qanday ko'rinadi (tanlangan chegirma, saqlanmagan o'zgarishlar bilan) */
function StudentPreview({ settings, discount, draft, preview }: { settings: PreorderSettings; discount: PreorderDiscount | null; draft: DiscountBooking | null; preview: BookingPreview | null }) {
  const t = copy.biz.settings;
  const b = t.booking;
  if (!discount || !draft || draft.bookingMode === "NONE" || !discount.price) {
    return (
      <View style={styles.previewBox}>
        <Txt style={styles.hint}>{t.previewNone}</Txt>
      </View>
    );
  }
  if (!preview || !preview.kind || !preview.amounts || !preview.rules) {
    return (
      <View style={styles.previewBox}>
        <Loading />
      </View>
    );
  }
  const kind = preview.kind;
  const today = toTashkent(new Date()).date.getTime();
  const dayName = (iso: string) => {
    const d = new Date(iso);
    return `${d.getTime() === today ? b.today : b.tomorrow} · ${copy.weekdaysShort[(d.getUTCDay() + 6) % 7]}`;
  };
  const r = preview.rules;
  const lastDay = (iso: string) => {
    const d = new Date(new Date(iso).getTime() - 86_400_000);
    const local = toTashkent(d).date;
    return `${local.getUTCDate()}-${copy.months[local.getUTCMonth()]}`;
  };

  let body: ReactNode;
  if (kind === "APPOINTMENT") {
    const first = preview.days?.[0];
    body = !first ? (
      <Txt style={styles.hint}>{t.previewEmpty}</Txt>
    ) : (
      <>
        <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
          {(preview.days ?? []).map((d) => (
            <View key={d.date} style={styles.chip}>
              <Txt style={[font(700), { fontSize: 13 }]}>{dayName(d.date)}</Txt>
            </View>
          ))}
        </View>
        <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
          {first.slots.slice(0, 8).map((s) => (
            <View key={s.start} style={[styles.slot, s.late ? styles.slotLate : null]}>
              <Txt style={[mono(600), { fontSize: 13, color: s.late ? colors.placeholder : colors.ink }]}>{formatMinute(toTashkent(new Date(s.start)).minute)}</Txt>
              <Txt style={{ fontSize: 10, color: colors.muted }}>{s.late ? b.late : b.left(draft.staffCount)}</Txt>
            </View>
          ))}
        </View>
      </>
    );
  } else if (kind === "PICKUP_WINDOW") {
    const windows = preview.windows ?? [];
    body =
      windows.length === 0 ? (
        <Txt style={styles.hint}>{t.previewEmpty}</Txt>
      ) : (
        <View style={{ gap: 6 }}>
          {windows.map((w) => (
            <View key={w.start} style={[styles.windowRow, w.late ? styles.slotLate : null]}>
              <Txt style={[font(700), { fontSize: 13, color: w.late ? colors.placeholder : colors.ink }]}>{dayName(w.date)}</Txt>
              <Txt style={[mono(), { fontSize: 13, color: w.late ? colors.placeholder : colors.ink }]}>{`${formatMinute(draft.windowFrom)}–${formatMinute(draft.windowTo % 1440)}`}</Txt>
            </View>
          ))}
        </View>
      );
  } else {
    body = (
      <View style={[styles.windowRow, { borderWidth: 0 }]}>
        <Txt style={[font(700), { fontSize: 13 }]}>{b.quantity}</Txt>
        <Txt style={[mono(), { fontSize: 13 }]}>{`1 / ${preview.quantity ?? 0}`}</Txt>
      </View>
    );
  }

  return (
    <View testID="booking-preview" style={styles.previewBox}>
      <View style={styles.handle} />
      <Txt style={[font(800), { fontSize: 18 }]}>{b.titles[kind]}</Txt>
      {body}
      <View style={styles.amounts}>
        <View style={[styles.row, { justifyContent: "space-between", gap: 12 }]}>
          <Txt numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.muted }}>
            {discount.title}
          </Txt>
          <Txt style={[mono(), { fontSize: 13 }]}>{formatSom(preview.amounts.totalFinal)}</Txt>
        </View>
        <View style={[styles.row, { justifyContent: "space-between", marginTop: 4 }]}>
          <Txt style={[font(700), { fontSize: 13 }]}>{preview.prepay === "NONE" ? b.payLater : b.payNow}</Txt>
          <Txt style={[mono(700), { fontSize: 13 }]}>{formatSom(preview.prepay === "NONE" ? preview.amounts.totalFinal : preview.amounts.prepayAmount)}</Txt>
        </View>
      </View>
      <View style={styles.rules}>
        <Txt style={[font(700), { fontSize: 14 }]}>{b.rulesTitle}</Txt>
        <Txt style={styles.rulesText}>
          {kind === "PREPAID_PICKUP"
            ? `${r.validUntil ? b.prepaidUntil(lastDay(r.validUntil)) : ""} ${r.keepPercent === 0 ? b.expireRefund : r.keepPercent >= 100 ? b.expireNoRefund : b.expireKeep(r.keepPercent)}`.trim()
            : `${b.freeCancel(r.freeCancelMinutes)}${preview.prepay === "NONE" ? "" : ` ${r.keepPercent > 0 ? (kind === "PICKUP_WINDOW" ? b.lateKeepWindow(r.keepPercent) : b.lateKeep(r.keepPercent)) : b.lateFree}`}`}
        </Txt>
        {!r.autoConfirm ? <Txt style={styles.rulesText}>{b.manualConfirm}</Txt> : null}
      </View>
      {!settings.enabled ? <Txt style={[font(600), { fontSize: 12, color: colors.warn }]}>{t.previewDisabled}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row" },
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  // saytda `-mb-2` (markazda — sotuvlardagidek `self-start` emas)
  back: { marginBottom: -8 },
  title: { fontSize: 30, lineHeight: 30, letterSpacing: em(30, -0.03) },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted },
  block: { gap: 12, borderRadius: 18, backgroundColor: colors.white, padding: 16 },
  notice: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  discount: { gap: 12, paddingVertical: 10 },
  discountLine: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  field: { flexGrow: 1, flexBasis: 150 },
  timeBox: { flex: 1, minWidth: 0, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, justifyContent: "center", paddingHorizontal: 12 },
  editor: { gap: 12, borderRadius: 16, backgroundColor: colors.paper, padding: 12 },
  kind: { alignItems: "flex-start", gap: 4, borderRadius: 14, borderWidth: 1.5, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  previewBox: { gap: 12, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.paper, padding: 16 },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line },
  chip: { borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 6 },
  slot: { width: "23%", flexGrow: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  slotLate: { borderColor: colors.lineSoft, backgroundColor: colors.surface },
  windowRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 8 },
  amounts: { borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12 },
  rules: { borderRadius: 14, backgroundColor: colors.infoBg, paddingHorizontal: 16, paddingVertical: 12 },
  rulesText: { marginTop: 4, fontSize: 13, lineHeight: 19 },
});
