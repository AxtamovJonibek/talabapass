"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Field, PhoneInput, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { LIFT } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { formatSom, MINUS, phoneNational } from "@/lib/format";
import { NOTE_MAX, orderAmounts, type BookingBlock, type BookingKind } from "@/lib/preorder";
import { formatMinute, toTashkent } from "@/lib/time";
import { useRouter } from "@/i18n/navigation";
import { bookingOfferAction, createOrderAction } from "@/server/actions/preorder";
import type { CreateOrderError } from "@/server/preorder/orders";
import type { BookingOffer, BookingSlot } from "@/server/preorder/settings";
import { useLastDay } from "./use-last-day";

type Step = "day" | "slot" | "details" | "summary";
/** Bosqichlar rejimga qarab: uchrashuv — kun va vaqt; oyna — kun; to'lab olib ketish — vaqtsiz */
const STEPS: Record<BookingKind, Step[]> = {
  APPOINTMENT: ["day", "slot", "details", "summary"],
  PICKUP_WINDOW: ["day", "details", "summary"],
  PREPAID_PICKUP: ["details", "summary"],
};
const DAY_MS = 86_400_000;

const clock = (iso: string) => formatMinute(toTashkent(new Date(iso)).minute);

/** Bosiladigan katta variant (kun, slot, oyna): oq karta, tanlangani qora chegara. */
function Choice({ selected, disabled, onClick, children, className }: { selected?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "box-border flex items-center rounded-14 border-hair bg-white text-left font-sans text-ink disabled:cursor-default disabled:bg-surface disabled:text-placeholder",
        selected ? "border-ink" : "border-line",
        !disabled && LIFT,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** "Bugun" / "Ertaga" va "Shanba, 15-noyabr" */
function useDayLabel() {
  const t = useTranslations("booking");
  const tt = useTranslations();
  return (date: Date) => {
    const today = toTashkent(new Date()).date.getTime();
    const rel = date.getTime() === today ? t("today") : date.getTime() === today + DAY_MS ? t("tomorrow") : null;
    const day = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    const full = `${tt(`weekday.long.${day}` as "weekday.long.1")}, ${date.getUTCDate()}-${tt(`month.name.${date.getUTCMonth() + 1}` as "month.name.1")}`;
    return { rel, full };
  };
}

/**
 * Band qilish (T5 / WT3): tugma va bosqichli oyna. Bosqichlar chegirma rejimiga qarab (`STEPS`); hamma shart (vaqt yoki
 * muddat, qaytarish qoidasi) to'lovdan oldingi "yakun" bosqichida. Taklif har ochilishda serverdan (`bookingOfferAction`);
 * yuborishda server hammasini qayta tekshiradi. Hozir band qilib bo'lmasa (`blocked`) — o'chiq tugma va ostida sababi.
 * Dizaynda chizilmagan — mavjud primitivlardan.
 */
export function BookingButton(props: { discountId: string; phone: string; kind: BookingKind; blocked: BookingBlock | null; className?: string; size?: "md" | "cta" }) {
  const t = useTranslations("booking");
  const reasonId = useId();
  if (!props.blocked) return <BookingFlow {...props} />;
  return (
    <div className={cn("flex flex-col gap-1.5", props.className)}>
      <Button variant="idle" size={props.size ?? "md"} block disabled aria-describedby={reasonId}>
        <Icon name="clock" size={18} strokeWidth={2.2} />
        {t(`kinds.${props.kind}.button`)}
      </Button>
      <p id={reasonId} className="m-0 text-center text-13 font-semibold text-muted" data-testid="booking-blocked">
        {t(`blocked.${props.blocked}`)}
      </p>
    </div>
  );
}

function BookingFlow({ discountId, phone, kind, className, size = "md" }: { discountId: string; phone: string; kind: BookingKind; className?: string; size?: "md" | "cta" }) {
  const t = useTranslations("booking");
  const router = useRouter();
  const dayLabel = useDayLabel();
  const lastDay = useLastDay();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState<BookingOffer | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<Step>(STEPS[kind][0]!);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<BookingSlot | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [phoneText, setPhoneText] = useState(phoneNational(phone));
  const [error, setError] = useState<CreateOrderError | null>(null);
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  const steps = STEPS[offer?.kind ?? kind];
  const index = steps.indexOf(step);

  const load = () =>
    startLoading(async () => {
      setLoadError(false);
      const next = await bookingOfferAction(discountId).catch(() => null);
      if (!next) return setLoadError(true);
      setOffer(next);
      setQuantity((q) => Math.min(q, next.maxQuantity));
    });

  const show = () => {
    setError(null);
    setSlot(null);
    setDay(null);
    setQuantity(1);
    setStep(STEPS[kind][0]!);
    setOffer(null);
    setOpen(true);
    load();
  };

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };
  const back = () => (index > 0 ? go(steps[index - 1]!) : setOpen(false));

  const dayInfo = offer?.days.find((d) => d.date === day) ?? null;
  const amounts = offer ? orderAmounts(offer.unit, quantity, { type: offer.prepay, percent: offer.prepayPercent }) : null;
  const labelOf = (date: string) => dayLabel(new Date(`${date}T00:00:00Z`));

  const submit = () =>
    startSending(async () => {
      if (!offer) return;
      setError(null);
      const result = await createOrderAction({
        discountId,
        slotStart: slot?.start,
        quantity,
        note: note.trim() || undefined,
        phone: `+998${phoneText.replace(/\D/g, "")}`,
      });
      if (!result.ok) {
        setError(result.error);
        if (result.error === "slotFull" || result.error === "slot") {
          // Joy hozirgina to'ldi — yangilangan taklif bilan vaqt (yoki kun) tanlashga qaytamiz
          setSlot(null);
          const fresh = await bookingOfferAction(discountId).catch(() => null);
          if (fresh) setOffer(fresh);
          setStep(offer.kind === "APPOINTMENT" ? "slot" : "day");
        }
        return;
      }
      setOpen(false);
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
      else router.push(`/buyurtmalar/${result.orderId}`);
    });

  const phoneValid = /^\d{9}$/.test(phoneText.replace(/\D/g, ""));
  const slotError = error === "slotFull" || error === "slot" ? <p className="col-span-full m-0 text-13 font-semibold text-danger">{t(`errors.${error}`)}</p> : null;

  return (
    <>
      <Button ref={trigger} variant="outline" size={size} block onClick={show} aria-haspopup="dialog" aria-expanded={open} className={className} data-testid="booking-open">
        <Icon name="clock" size={18} strokeWidth={2.2} />
        {t(`kinds.${kind}.button`)}
      </Button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t(`kinds.${kind}.title`)}
        closeLabel={t("close")}
        anchor={trigger}
        width={420}
        description={
          offer ? (
            <span className="flex items-center justify-between gap-3">
              <span className="font-bold text-ink">{t(`steps.${step}`)}</span>
              <span className="font-mono text-12">{t("step", { n: index + 1, total: steps.length })}</span>
            </span>
          ) : null
        }
      >
        <div className="flex flex-col gap-3 px-4 pb-2" data-testid="booking-sheet">
          {offer && index > 0 ? <BackButton onClick={back} variant="text" className="-mt-1 self-start" /> : null}

          {!offer ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-14 text-muted">
              {loadError ? (
                <>
                  {t("errors.notAvailable")}
                  <Button variant="outline-soft" size="sm" onClick={load}>
                    {t("errors.loadFailed")}
                  </Button>
                </>
              ) : (
                <span aria-busy={loading}>{t("loading")}</span>
              )}
            </div>
          ) : step === "day" && offer.kind === "APPOINTMENT" ? (
            <div className="grid gap-2">
              {offer.days.map((d) => {
                const free = d.slots.filter((s) => !s.disabled).length;
                const label = labelOf(d.date);
                return (
                  <Choice
                    key={d.date}
                    selected={day === d.date}
                    disabled={free === 0}
                    onClick={() => {
                      setDay(d.date);
                      setSlot(null);
                      go("slot");
                    }}
                    className="min-h-16 justify-between gap-3 px-4 py-3"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-16 font-bold">{label.rel ?? label.full}</span>
                      {label.rel ? <span className="text-13 text-muted">{label.full}</span> : null}
                    </span>
                    <span className="text-13 font-semibold">{free === 0 ? t("noSlots") : t("leftTimes", { n: free })}</span>
                  </Choice>
                );
              })}
            </div>
          ) : step === "day" ? (
            <div role="radiogroup" aria-label={t("steps.day")} className="grid gap-2">
              {offer.windows.map((w) => {
                const label = labelOf(w.date);
                return (
                  <Choice
                    key={w.start}
                    selected={slot?.start === w.start}
                    disabled={w.disabled}
                    onClick={() => {
                      setSlot(w);
                      setQuantity((q) => Math.min(q, Math.max(1, Math.min(offer.maxQuantity, w.left))));
                      go("details");
                    }}
                    className="min-h-16 justify-between gap-3 px-4 py-3"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-16 font-bold">{label.rel ?? label.full}</span>
                      <span className="font-mono text-13 text-muted">{t("window", { from: clock(w.start), to: clock(w.end) })}</span>
                    </span>
                    <span className="text-13 font-semibold">{w.disabled ? (w.left === 0 ? t("full") : t("windowLate")) : t("leftPieces", { n: w.left })}</span>
                  </Choice>
                );
              })}
              {slotError}
            </div>
          ) : step === "slot" && dayInfo ? (
            <div role="radiogroup" aria-label={t("steps.slot")} className="grid grid-cols-[repeat(auto-fill,minmax(min(100px,100%),1fr))] gap-2">
              {dayInfo.slots.map((s) => (
                <Choice
                  key={s.start}
                  selected={slot?.start === s.start}
                  disabled={s.disabled}
                  onClick={() => {
                    setSlot(s);
                    go("details");
                  }}
                  className="h-16 flex-col justify-center gap-0.5 px-2"
                >
                  <span className="font-mono text-16 font-semibold">{clock(s.start)}</span>
                  <span className="text-11 font-semibold text-muted">{s.disabled ? (s.left === 0 ? t("full") : t("late")) : t("left", { n: s.left })}</span>
                </Choice>
              ))}
              {slotError}
            </div>
          ) : step === "details" ? (
            <div className="flex flex-col gap-3">
              {offer.kind !== "APPOINTMENT" ? (
                <QuantityRow
                  value={quantity}
                  max={Math.max(1, Math.min(offer.maxQuantity, offer.kind === "PICKUP_WINDOW" && slot ? slot.left : offer.maxQuantity))}
                  onChange={setQuantity}
                  label={t("quantity")}
                  hint={offer.maxQuantity < 20 ? t("perStudent", { n: offer.maxQuantity }) : null}
                />
              ) : null}
              <Field label={t("note")} htmlFor="booking-note" counter={`${note.length}/${NOTE_MAX}`}>
                <Textarea id="booking-note" rows={2} maxLength={NOTE_MAX} placeholder={t(`kinds.${offer.kind}.notePlaceholder`)} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Field label={t("phone")} htmlFor="booking-phone" hint={t("phoneHint")} error={error === "phone" ? t("errors.phone") : undefined}>
                <PhoneInput id="booking-phone" value={phoneText} onChange={(e) => setPhoneText(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))} invalid={error === "phone"} />
              </Field>
              <Button size="md" block disabled={!phoneValid} onClick={() => go("summary")}>
                {t("next")}
              </Button>
            </div>
          ) : step === "summary" && amounts && (offer.kind === "PREPAID_PICKUP" || slot) ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-16 bg-white px-4 py-3.5">
                <div className="text-13 text-muted">{offer.businessName}</div>
                <div className="mt-0.5 text-17 font-extrabold">
                  {offer.title}
                  {offer.kind === "APPOINTMENT" ? null : ` × ${quantity}`}
                </div>
                <div className="mt-1 text-14 font-semibold" data-testid="booking-when">
                  {offer.kind === "PREPAID_PICKUP" && offer.prepaid
                    ? t("summaryPrepaid", { date: lastDay(offer.prepaid.validUntil), days: offer.prepaid.validDays })
                    : slot
                      ? t(offer.kind === "APPOINTMENT" ? "summaryWhen" : "summaryWindow", {
                          day: (() => {
                            const label = dayLabel(toTashkent(new Date(slot.start)).date);
                            return label.rel ?? label.full;
                          })(),
                          time: `${clock(slot.start)}–${clock(slot.end)}`,
                        })
                      : null}
                </div>
                {offer.kind === "PREPAID_PICKUP" ? <div className="mt-0.5 text-13 text-muted">{t("prepaidHours", { hours: offer.workingHours })}</div> : null}
                <div className="mt-3 flex flex-col gap-2 font-mono text-14">
                  <div className="flex justify-between">
                    <span className="text-muted">{t("original")}</span>
                    <s className="text-muted">{formatSom(amounts.totalOriginal)}</s>
                  </div>
                  <div className="flex justify-between text-rust">
                    <span>{t("discount")}</span>
                    <span>
                      {MINUS}
                      {formatSom(amounts.totalDiscount)}
                    </span>
                  </div>
                  <div className="flex justify-between font-sans font-bold">
                    <span>{t("total")}</span>
                    <span className="font-mono">{formatSom(amounts.totalFinal)}</span>
                  </div>
                  <div className="border-t-hair-dashed" />
                  {offer.prepay === "NONE" ? (
                    <div className="font-sans text-14 font-semibold">{t("noPrepay")}</div>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="font-sans font-bold">{t("payNow")}</span>
                        <span className="text-26 font-semibold" data-testid="booking-pay-now">
                          {formatSom(amounts.prepayAmount)}
                        </span>
                      </div>
                      {amounts.totalFinal > amounts.prepayAmount ? (
                        <div className="flex justify-between">
                          <span className="text-muted">{t("payLater")}</span>
                          <span>{formatSom(amounts.totalFinal - amounts.prepayAmount)}</span>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
              <BookingRules offer={offer} />
              {error && error !== "slotFull" && error !== "slot" ? (
                <div role="alert" className="rounded-14 bg-danger-bg px-3.5 py-3 text-14 font-semibold text-danger">
                  {t(`errors.${error}`)}
                </div>
              ) : null}
              <Button size="cta" strong block loading={sending} onClick={submit} data-testid="booking-submit">
                {offer.prepay === "NONE" ? t("book") : t("pay", { amount: formatSom(amounts.prepayAmount) })}
              </Button>
            </div>
          ) : null}
        </div>
      </BottomSheet>
    </>
  );
}

function QuantityRow({ value, max, onChange, label, hint }: { value: number; max: number; onChange: (n: number) => void; label: string; hint: string | null }) {
  const t = useTranslations("booking");
  const round = cn("flex size-10 items-center justify-center rounded-full border-0 bg-surface text-ink disabled:text-placeholder", LIFT);
  return (
    <div className="flex items-center justify-between gap-3 rounded-14 bg-white px-4 py-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-15 font-bold">{label}</span>
        {hint ? <span className="text-12 text-muted">{hint}</span> : null}
      </span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={t("less")} disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))} className={round}>
          <Icon name="minus" size={18} strokeWidth={2.4} />
        </button>
        <output aria-live="polite" className="w-8 text-center font-mono text-20 font-semibold" data-testid="booking-quantity">
          {value}
        </output>
        <button type="button" aria-label={t("more")} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={round}>
          <Icon name="plus" size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

/** Bekor qilish / kelmaslik / muddat qoidasi — to'lovdan oldin (talaba oynasi va biznes preview'i bitta matn). */
export function BookingRules({ offer }: { offer: Pick<BookingOffer, "kind" | "prepay" | "freeCancelMinutes" | "keepPercent" | "autoConfirm" | "prepaid"> }) {
  const t = useTranslations("booking");
  const lastDay = useLastDay();
  return (
    <div className="rounded-14 bg-info-bg px-4 py-3 text-13 leading-[1.45]" data-testid="booking-rules">
      <b className="text-14">{t("rulesTitle")}</b>
      {offer.kind === "PREPAID_PICKUP" ? (
        <p className="m-0 mt-1">
          {offer.prepaid ? t("prepaidUntil", { date: lastDay(offer.prepaid.validUntil) }) : null}{" "}
          {offer.keepPercent === 0 ? t("expireRefund") : offer.keepPercent >= 100 ? t("expireNoRefund") : t("expireKeep", { pct: offer.keepPercent })}
        </p>
      ) : (
        <p className="m-0 mt-1">
          {t("freeCancel", { minutes: offer.freeCancelMinutes })}{" "}
          {offer.prepay === "NONE" ? null : offer.keepPercent > 0 ? t(offer.kind === "PICKUP_WINDOW" ? "lateKeepWindow" : "lateKeep", { pct: offer.keepPercent }) : t("lateFree")}
        </p>
      )}
      {!offer.autoConfirm ? <p className="m-0 mt-1">{t("manualConfirm")}</p> : null}
    </div>
  );
}
