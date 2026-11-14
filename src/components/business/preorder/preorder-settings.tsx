"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icons";
import { LIFT } from "@/components/ui/motion";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { BookingRules } from "@/components/student/booking/booking-sheet";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatSom } from "@/lib/format";
import {
  BOOKING_KINDS,
  bookingBlock,
  discountSlots,
  orderAmounts,
  PER_STUDENT_MAX,
  pickupWindows,
  prepaidExpiry,
  prepayFor,
  quantityMax,
  SERVICE_MINUTES,
  STAFF_MAX,
  VALID_DAYS_MAX,
  windowBlock,
  type BookingKind,
  type DaySchedule,
  type DiscountBooking,
  type PreorderSettingsInput,
} from "@/lib/preorder";
import { formatMinute, parseMinute, toTashkent } from "@/lib/time";
import { saveDiscountBookingAction, savePreorderSettingsAction, setPreorderPausedAction } from "@/server/actions/preorder";
import type { OwnerDiscount, OwnerPreorder } from "@/server/preorder/settings";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const KIND_ICON: Record<BookingKind, IconName> = { APPOINTMENT: "cut", PREPAID_PICKUP: "book", PICKUP_WINDOW: "bowl" };
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

function NumberField({ id, label, value, onChange, min, max, hint }: { id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; hint?: string }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
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

/** "14:00 dan — 20:00 gacha" (vaqt maydonlari juftligi) */
function TimeRange({ label, from, to, onChange }: { label: string; from: number; to: number; onChange: (from: number, to: number) => void }) {
  const t = useTranslations("preorder");
  return (
    <span className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5 text-13 text-muted">
      <Input
        type="time"
        step={900}
        aria-label={`${label} ${t("from")}`}
        compact
        tight
        mono={14}
        className="min-w-0"
        invalid={to <= from}
        value={formatMinute(from)}
        onChange={(e) => onChange(parseMinute(e.target.value) ?? from, to)}
      />
      {t("from")}
      <Input
        type="time"
        step={900}
        aria-label={`${label} ${t("to")}`}
        compact
        tight
        mono={14}
        className="min-w-0"
        invalid={to <= from}
        value={formatMinute(to % 1440)}
        onChange={(e) => onChange(from, endMinute(parseMinute(e.target.value), to))}
      />
      {t("to")}
    </span>
  );
}

/**
 * Biznes → Sozlamalar → "Oldindan band qilish". Umumiy qoidalar (yoqish, ish jadvali, tayyorlash vaqti, to'lov, bekor qilish,
 * tasdiqlash) — "Saqlash" bilan; har chegirmaning rejimi (3 karta: vaqtli uchrashuv / to'lab olib ketish / olib ketish oynasi)
 * va maydonlari — chegirma kartasidagi "Saqlash" bilan; "Bugun qabul qilmayman" — darhol. O'ngda (telefonda pastda) tanlangan
 * chegirma talabaga qanday ko'rinishining jonli preview'i (`src/lib/preorder` dagi bir xil hisob). Dizaynda chizilmagan.
 */
export function PreorderSettingsForm({ data }: { data: OwnerPreorder }) {
  const t = useTranslations("preorder");
  const tt = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState<PreorderSettingsInput>(data.settings);
  const [paused, setPaused] = useState(data.pausedToday);
  const [discounts, setDiscounts] = useState(data.discounts);
  const [drafts, setDrafts] = useState<Record<string, DiscountBooking>>(() => Object.fromEntries(data.discounts.map((d) => [d.id, d.booking])));
  const [editing, setEditing] = useState<string | null>(() => (data.discounts.find((d) => d.booking.bookingMode !== "NONE") ?? data.discounts.find((d) => d.price))?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof PreorderSettingsInput>(key: K, value: PreorderSettingsInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const dayRow = (day: number) => form.schedule.find((d) => d.day === day);
  const setDay = (day: number, next: DaySchedule | null) =>
    set("schedule", [...form.schedule.filter((d) => d.day !== day), ...(next ? [next] : [])].sort((a, b) => a.day - b.day));
  const rangeBad = form.schedule.some((d) => d.to <= d.from);
  const noneMarked = form.enabled && !discounts.some((d) => d.booking.bookingMode !== "NONE" && d.price);
  const editingDiscount = discounts.find((d) => d.id === editing) ?? null;

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
          {noneMarked ? (
            <p className="m-0 rounded-12 bg-warn-bg px-3.5 py-2.5 text-13 font-semibold text-warn" data-testid="preorder-none-marked">
              {t("noneMarked")}
            </p>
          ) : null}
          {discounts.length === 0 ? (
            <p className="m-0 text-14 text-muted">{t("noDiscounts")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {discounts.map((d, i) => {
                const open = editing === d.id;
                return (
                  <li key={d.id} className={cn("flex flex-col gap-3 py-2.5", i > 0 && "border-0 border-t border-solid border-line-soft")} data-testid="preorder-discount">
                    <div className="flex min-h-11 items-center gap-3">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-15 font-semibold">{d.title}</span>
                        <span className="font-mono text-12 text-muted">
                          {d.price ? `${formatSom(d.price.final)} ${tt("common.currency")}` : t("noPrice")} ·{" "}
                          <span className={d.booking.bookingMode === "NONE" ? "" : "font-sans font-bold text-ink"}>{t(`kindShort.${d.booking.bookingMode}`)}</span>
                        </span>
                      </span>
                      <Button variant="outline-soft" size="sm" disabled={!d.price} aria-expanded={open} onClick={() => setEditing(open ? null : d.id)}>
                        {open ? t("close") : t("configure")}
                      </Button>
                    </div>
                    {open ? (
                      <DiscountBookingEditor
                        discount={d}
                        draft={drafts[d.id] ?? d.booking}
                        settings={form}
                        onChange={(next) => setDrafts((all) => ({ ...all, [d.id]: next }))}
                        onSaved={(booking) => setDiscounts((list) => list.map((x) => (x.id === d.id ? { ...x, booking } : x)))}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Block>

        <h2 className="m-0 mt-2 px-1 text-18 font-extrabold">{t("general")}</h2>

        <Block title={t("schedule")} hint={t("scheduleHint")}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {DAYS.map((day) => {
              const row = dayRow(day);
              const name = tt(`weekday.long.${day}`);
              return (
                <li key={day} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="w-[92px] text-14 font-bold">{name}</span>
                  <Switch small checked={Boolean(row)} onChange={(on) => setDay(day, on ? { day, from: 14 * 60, to: 20 * 60 } : null)} label={name} />
                  {row ? (
                    <span className="flex min-w-[240px] flex-1">
                      <TimeRange label={name} from={row.from} to={row.to} onChange={(from, to) => setDay(day, { ...row, from, to })} />
                    </span>
                  ) : (
                    <span className="text-13 text-muted">{t("closed")}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Block>

        <Block title={t("lead")} hint={t("leadHint")}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-3">
            <NumberField id="preorder-lead" label={t("leadMinutes")} value={form.leadMinutes} min={0} max={1440} onChange={(v) => set("leadMinutes", v)} />
          </div>
        </Block>

        <Block title={t("daysAhead")} hint={t("daysAheadHint")}>
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
        <StudentPreview settings={form} paused={paused} discount={editingDiscount} draft={editingDiscount ? (drafts[editingDiscount.id] ?? editingDiscount.booking) : null} />
      </aside>
    </div>
  );
}

/** Bir chegirmaning rejimi: 3 karta (misollar bilan), faqat tanlangan rejim maydonlari, "Saqlash". */
function DiscountBookingEditor({
  discount,
  draft,
  settings,
  onChange,
  onSaved,
}: {
  discount: OwnerDiscount;
  draft: DiscountBooking;
  settings: PreorderSettingsInput;
  onChange: (next: DiscountBooking) => void;
  onSaved: (booking: DiscountBooking) => void;
}) {
  const t = useTranslations("preorder");
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof DiscountBooking>(key: K, value: DiscountBooking[K]) => onChange({ ...draft, [key]: value });
  const mode = draft.bookingMode;
  const id = (name: string) => `${name}-${discount.id}`;

  // Jadval/oyna chegirma soatlariga to'g'ri kelmasa — talabada tugma o'chiq turadi; egasiga shu yerda aytamiz
  const now = new Date();
  const offHours =
    mode === "APPOINTMENT"
      ? bookingBlock({ ...settings, slotMinutes: draft.serviceMinutes, pausedOn: null }, discount.schedule, now, () => draft.staffCount) === "hours"
      : mode === "PICKUP_WINDOW"
        ? windowBlock({ ...settings, pausedOn: null }, discount.schedule, { from: draft.windowFrom, to: draft.windowTo }, now, () => draft.windowCapacity) === "hours"
        : false;
  const hours = `${formatMinute(discount.schedule.fromMinute)}–${formatMinute(discount.schedule.toMinute % 1440)}`;
  const keepRule = draft.expireKeepPercent === 0 ? "refund" : draft.expireKeepPercent >= 100 ? "none" : "partial";

  const save = () =>
    start(async () => {
      setError(null);
      const result = await saveDiscountBookingAction(discount.id, draft);
      if (result.ok) {
        onSaved(draft);
        toast(t("discountSaved"));
      } else setError(t(`discountErrors.${result.error}`));
    });

  return (
    <div className="flex flex-col gap-3 rounded-16 bg-paper p-3" data-testid="booking-editor">
      <div role="radiogroup" aria-label={t("kindTitle")} className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-2">
        {BOOKING_KINDS.map((kind) => {
          const selected = mode === kind;
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => set("bookingMode", kind)}
              className={cn("box-border flex flex-col items-start gap-1 rounded-14 border-hair bg-white px-3.5 py-3 text-left font-sans text-ink", selected ? "border-ink" : "border-line", LIFT)}
              data-testid={`kind-${kind}`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <Icon name={KIND_ICON[kind]} size={22} />
                <span className={cn("flex size-5 items-center justify-center rounded-full border-hair", selected ? "border-ink bg-ink text-white" : "border-line")}>
                  {selected ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                </span>
              </span>
              <span className="text-15 font-extrabold">{t(`kinds.${kind}.title`)}</span>
              <span className="text-12 leading-[1.35] text-muted">{t(`kinds.${kind}.example`)}</span>
            </button>
          );
        })}
      </div>

      {mode === "NONE" ? (
        <p className="m-0 text-13 text-muted">{t("kindNone")}</p>
      ) : (
        <>
          <p className="m-0 text-13 leading-[1.4] text-muted">{t(`kinds.${mode}.hint`)}</p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-3">
            {mode === "APPOINTMENT" ? (
              <>
                <NumberField id={id("service")} label={t("serviceMinutes")} value={draft.serviceMinutes} min={SERVICE_MINUTES.min} max={SERVICE_MINUTES.max} onChange={(v) => set("serviceMinutes", v)} />
                <NumberField id={id("staff")} label={t("staffCount")} value={draft.staffCount} min={1} max={STAFF_MAX} onChange={(v) => set("staffCount", v)} />
              </>
            ) : mode === "PREPAID_PICKUP" ? (
              <>
                <NumberField id={id("valid")} label={t("validDays")} value={draft.validDays} min={1} max={VALID_DAYS_MAX} onChange={(v) => set("validDays", v)} />
                <NumberField id={id("stock")} label={t("stock")} value={draft.stock} min={0} max={100_000} onChange={(v) => set("stock", v)} />
                <NumberField id={id("per-student")} label={t("perStudentMax")} value={draft.perStudentMax} min={1} max={PER_STUDENT_MAX} onChange={(v) => set("perStudentMax", v)} />
              </>
            ) : (
              <>
                <NumberField id={id("window-cap")} label={t("windowCapacity")} value={draft.windowCapacity} min={1} max={500} onChange={(v) => set("windowCapacity", v)} />
                <NumberField id={id("per-student")} label={t("perStudentMax")} value={draft.perStudentMax} min={1} max={PER_STUDENT_MAX} onChange={(v) => set("perStudentMax", v)} />
              </>
            )}
          </div>
          {mode === "APPOINTMENT" ? <p className="m-0 text-13 text-muted">{t("appointmentFieldsHint")}</p> : null}
          {mode === "PICKUP_WINDOW" ? (
            <Field label={t("window")} hint={t("windowHint")}>
              <span className="flex">
                <TimeRange label={t("window")} from={draft.windowFrom} to={draft.windowTo} onChange={(from, to) => onChange({ ...draft, windowFrom: from, windowTo: to })} />
              </span>
            </Field>
          ) : null}
          {mode === "PREPAID_PICKUP" ? (
            <div className="flex flex-col gap-2">
              <span className="text-13 font-bold">{t("expireRule")}</span>
              <Segmented
                size="choice"
                label={t("expireRule")}
                value={keepRule}
                onChange={(v) => set("expireKeepPercent", v === "refund" ? 0 : v === "none" ? 100 : 50)}
                options={(["refund", "partial", "none"] as const).map((r) => ({ value: r, label: t(`expireRules.${r}`) }))}
              />
              {keepRule === "partial" ? (
                <NumberField id={id("expire-keep")} label={t("expireKeep")} value={draft.expireKeepPercent} min={1} max={99} onChange={(v) => set("expireKeepPercent", v)} />
              ) : null}
              <p className="m-0 text-13 text-muted">{t("expireHint")}</p>
            </div>
          ) : null}
          {offHours ? (
            <p className="m-0 rounded-12 bg-warn-bg px-3.5 py-2.5 text-13 font-semibold text-warn" data-testid="preorder-off-hours">
              {t(mode === "APPOINTMENT" ? "offHours" : "offHoursWindow", { hours })}
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <div role="alert" className="rounded-12 bg-danger-bg px-3.5 py-2.5 text-13 font-semibold text-danger">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="orange" size="md" loading={saving} onClick={save} className="flex-1" data-testid="booking-editor-save">
          {t("discountSave")}
        </Button>
        {mode !== "NONE" ? (
          <Button variant="outline-soft" size="md" onClick={() => set("bookingMode", "NONE")}>
            {t("kindOff")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Talabaning band qilish oynasi qanday ko'rinadi (tanlangan chegirma, saqlanmagan o'zgarishlar bilan). */
function StudentPreview({ settings, paused, discount, draft }: { settings: PreorderSettingsInput; paused: boolean; discount: OwnerDiscount | null; draft: DiscountBooking | null }) {
  const t = useTranslations("booking");
  const tp = useTranslations("preorder");
  const tt = useTranslations();
  if (!discount || !draft || draft.bookingMode === "NONE" || !discount.price) {
    return <p className="m-0 rounded-22 border-hair border-line bg-paper p-4 text-13 text-muted">{tp("previewNone")}</p>;
  }
  const kind = draft.bookingMode;
  const now = new Date();
  const pausedOn = paused ? toTashkent(now).date : null;
  const prepay = prepayFor(kind, settings);
  const amounts = orderAmounts(discount.price, 1, prepay);
  const today = toTashkent(now).date.getTime();
  const dayName = (d: Date) => `${d.getTime() === today ? t("today") : t("tomorrow")} · ${tt(`weekday.short.${d.getUTCDay() === 0 ? 7 : d.getUTCDay()}` as "weekday.short.1")}`;
  const chip = "rounded-10 bg-white px-3 py-1.5 text-13 font-bold";
  const validUntil = prepaidExpiry(now, draft.validDays).toISOString();

  let body: ReactNode;
  if (kind === "APPOINTMENT") {
    const days = discountSlots({ ...settings, slotMinutes: draft.serviceMinutes, pausedOn }, discount.schedule, now);
    const first = days[0];
    body =
      first === undefined ? (
        <p className="m-0 text-13 text-muted">{tp("previewEmpty")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {days.map((d) => (
              <span key={d.date.getTime()} className={chip}>
                {dayName(d.date)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {first.slots.slice(0, 8).map((s) => (
              <span key={s.start.getTime()} className={cn("flex h-11 flex-col items-center justify-center rounded-10 border-hair font-mono text-13 font-semibold", s.late ? "border-line-soft bg-surface text-placeholder" : "border-line bg-white")}>
                {formatMinute(toTashkent(s.start).minute)}
                <span className="font-sans text-10 text-muted">{s.late ? t("late") : t("left", { n: draft.staffCount })}</span>
              </span>
            ))}
          </div>
        </>
      );
  } else if (kind === "PICKUP_WINDOW") {
    const windows = pickupWindows({ ...settings, pausedOn }, discount.schedule, { from: draft.windowFrom, to: draft.windowTo }, now);
    body =
      windows.length === 0 ? (
        <p className="m-0 text-13 text-muted">{tp("previewEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {windows.map((w) => (
            <span key={w.start.getTime()} className={cn("flex items-center justify-between rounded-10 border-hair px-3 py-2 text-13", w.late ? "border-line-soft bg-surface text-placeholder" : "border-line bg-white")}>
              <b>{dayName(w.date)}</b>
              <span className="font-mono">{t("window", { from: formatMinute(draft.windowFrom), to: formatMinute(draft.windowTo % 1440) })}</span>
            </span>
          ))}
        </div>
      );
  } else {
    body = (
      <div className="flex items-center justify-between rounded-10 bg-white px-3 py-2 text-13">
        <b>{t("quantity")}</b>
        <span className="font-mono">1 / {Math.min(quantityMax(kind, draft.perStudentMax), Math.max(draft.stock, 0))}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-22 border-hair border-line bg-paper p-4" aria-hidden="true" data-testid="booking-preview">
      <div className="mx-auto h-[5px] w-10 rounded-3 bg-line" />
      <div className="text-18 font-extrabold">{t(`kinds.${kind}.title`)}</div>
      {body}
      <div className="rounded-14 bg-white px-3.5 py-3 font-mono text-13">
        <div className="flex justify-between gap-3">
          <span className="truncate font-sans text-muted">{discount.title}</span>
          <span>{formatSom(amounts.totalFinal)}</span>
        </div>
        <div className="mt-1 flex justify-between font-sans font-bold">
          <span>{prepay.type === "NONE" ? t("payLater") : t("payNow")}</span>
          <span className="font-mono">{formatSom(prepay.type === "NONE" ? amounts.totalFinal : amounts.prepayAmount)}</span>
        </div>
      </div>
      <BookingRules
        offer={{
          kind,
          prepay: prepay.type,
          freeCancelMinutes: kind === "PREPAID_PICKUP" ? 0 : settings.freeCancelMinutes,
          keepPercent: kind === "PREPAID_PICKUP" ? draft.expireKeepPercent : settings.keepPercent,
          autoConfirm: settings.autoConfirm,
          prepaid: kind === "PREPAID_PICKUP" ? { validDays: draft.validDays, validUntil, stockLeft: draft.stock } : null,
        }}
      />
      {!settings.enabled ? <p className="m-0 text-12 font-semibold text-warn">{tp("previewDisabled")}</p> : null}
    </div>
  );
}
