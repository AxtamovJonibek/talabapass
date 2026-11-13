import { z } from "zod";
import { fromTashkent, openWindowStart, toTashkent, weekdayOf, windowEnd, type Schedule } from "./time";

/**
 * Oldindan band qilish: holat mashinasi, sozlamalar, slotlar, narx va bekor qilish qoidasi. Sof mantiq — forma, server
 * va testlar bitta koddan foydalanadi. Pul — butun so'm, vaqt — Toshkent (UTC+5).
 */

// ───────── holatlar ─────────

export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "READY", "COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderActor = "student" | "business" | "cashier" | "system";

/**
 * Ruxsat etilgan o'tishlar: kim, qaysi holatga, qaysi holatlardan. Boshqa hech qanday o'tish yo'q — server
 * `transitionOrder` faqat shu jadval bo'yicha shartli UPDATE qiladi.
 */
export const ORDER_TRANSITIONS: Record<OrderActor, Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  student: { CANCELLED: ["PENDING_PAYMENT", "PAID", "CONFIRMED", "READY"] },
  business: { CONFIRMED: ["PAID"], REJECTED: ["PAID", "CONFIRMED"], READY: ["CONFIRMED"] },
  cashier: { COMPLETED: ["CONFIRMED", "READY"] },
  system: {
    PAID: ["PENDING_PAYMENT"],
    // To'lovsiz bron yoki avtomatik tasdiqlash
    CONFIRMED: ["PAID"],
    // To'lanmadi / to'lov rad etildi / qo'lda tasdiqlash muddati o'tdi
    CANCELLED: ["PENDING_PAYMENT", "PAID"],
    NO_SHOW: ["CONFIRMED", "READY"],
  },
};

export function allowedFrom(actor: OrderActor, to: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[actor][to] ?? [];
}

export function canTransition(actor: OrderActor, from: OrderStatus, to: OrderStatus): boolean {
  return allowedFrom(actor, to).includes(from);
}

export const FINAL_STATUSES: readonly OrderStatus[] = ["COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW"];
/** Slotdagi joy bo'shaydigan holatlar (kelmagan talabaning joyi bo'shamaydi — vaqti o'tgan) */
export const RELEASES_SEAT: readonly OrderStatus[] = ["REJECTED", "CANCELLED"];
/** Biznes panelidagi filtrlar */
export const ORDER_FILTERS = {
  new: ["PAID"],
  preparing: ["CONFIRMED"],
  ready: ["READY"],
  done: ["COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW"],
} as const satisfies Record<string, readonly OrderStatus[]>;
export type OrderFilter = keyof typeof ORDER_FILTERS;

// ───────── sozlamalar ─────────

export const SLOT_LENGTHS = [15, 30, 60] as const;
export const PREORDER_MODES = ["PICKUP", "DINE_IN", "BOTH"] as const;
export const PREPAY_TYPES = ["FULL", "PARTIAL", "NONE"] as const;
export const QUANTITY_MAX = 20;
export const NOTE_MAX = 200;
/** Qo'lda tasdiqlashda biznes javob berishi kerak bo'lgan vaqt */
export const CONFIRM_TIMEOUT_MS = 10 * 60_000;
/** To'lov sahifasida kutish (to'lanmasa joy bo'shaydi) */
export const PAYMENT_TIMEOUT_MS = 15 * 60_000;

const minute = z.number().int().min(0).max(1440);
export const daySchedule = z
  .object({ day: z.number().int().min(1).max(7), from: minute, to: minute })
  .refine((d) => d.to > d.from, { message: "range" });
export type DaySchedule = z.infer<typeof daySchedule>;

export const preorderSettingsInput = z.object({
  enabled: z.boolean(),
  mode: z.enum(PREORDER_MODES),
  schedule: z
    .array(daySchedule)
    .max(7)
    .refine((list) => new Set(list.map((d) => d.day)).size === list.length, { message: "duplicate" }),
  slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  slotCapacity: z.number().int().min(1).max(500),
  leadMinutes: z.number().int().min(0).max(24 * 60),
  daysAhead: z.union([z.literal(0), z.literal(1)]),
  prepay: z.enum(PREPAY_TYPES),
  prepayPercent: z.number().int().min(1).max(100),
  freeCancelMinutes: z.number().int().min(0).max(24 * 60),
  keepPercent: z.number().int().min(0).max(100),
  autoConfirm: z.boolean(),
});
export type PreorderSettingsInput = z.infer<typeof preorderSettingsInput>;

export const DEFAULT_SCHEDULE: DaySchedule[] = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 14 * 60, to: 20 * 60 }));

export const DEFAULT_SETTINGS: PreorderSettingsInput = {
  enabled: false,
  mode: "BOTH",
  schedule: DEFAULT_SCHEDULE,
  slotMinutes: 30,
  slotCapacity: 10,
  leadMinutes: 30,
  daysAhead: 1,
  prepay: "FULL",
  prepayPercent: 50,
  freeCancelMinutes: 60,
  keepPercent: 100,
  autoConfirm: true,
};

/** Bazadagi JSON'dan jadval (buzilgan qatorlar tashlanadi). */
export function parseSchedule(value: unknown): DaySchedule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = daySchedule.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export type BookingConfig = Pick<PreorderSettingsInput, "schedule" | "slotMinutes" | "leadMinutes" | "daysAhead"> & {
  /** "Bugun qabul qilmayman" — shu Toshkent sanasi (UTC yarim tun) */
  pausedOn: Date | null;
};

// ───────── kunlar va slotlar ─────────

const DAY_MS = 86_400_000;

/** Band qilish mumkin bo'lgan Toshkent sanalari: bugun (+ ertaga), jadvalda bor va to'xtatilmagan kunlar. */
export function bookingDays(config: BookingConfig, now: Date): Date[] {
  const today = toTashkent(now).date;
  const days: Date[] = [];
  for (let i = 0; i <= config.daysAhead; i++) {
    const date = new Date(today.getTime() + i * DAY_MS);
    if (config.pausedOn && config.pausedOn.getTime() === date.getTime()) continue;
    if (!config.schedule.some((d) => d.day === weekdayOf(date))) continue;
    days.push(date);
  }
  return days;
}

export type Slot = { start: Date; end: Date; /** O'tgan yoki tayyorlashga vaqt yetmaydi */ late: boolean };

/** Sanadagi barcha slotlar (oxirgisi qabul oralig'i ichida tugaydi). */
export function slotsOn(config: BookingConfig, date: Date, now: Date): Slot[] {
  const day = config.schedule.find((d) => d.day === weekdayOf(date));
  if (!day) return [];
  const earliest = now.getTime() + config.leadMinutes * 60_000;
  const slots: Slot[] = [];
  for (let m = day.from; m + config.slotMinutes <= day.to; m += config.slotMinutes) {
    const start = fromTashkent(date, m);
    slots.push({ start, end: new Date(start.getTime() + config.slotMinutes * 60_000), late: start.getTime() < earliest });
  }
  return slots;
}

/** Talaba yuborgan slot haqiqatan shu jadvalda bormi va hali ochiqmi (server tekshiruvi). */
export function findSlot(config: BookingConfig, start: Date, now: Date): Slot | null {
  const date = toTashkent(start).date;
  if (!bookingDays(config, now).some((d) => d.getTime() === date.getTime())) return null;
  const slot = slotsOn(config, date, now).find((s) => s.start.getTime() === start.getTime());
  return slot && !slot.late ? slot : null;
}

/** Slot chegirma oralig'i ichidami: boshlanishi ochiq oraliqda, tugashi shu oraliq yopilishidan kech emas (kun, muddat, yarim tun ham). */
export function slotInDiscount(discount: Schedule, slot: Pick<Slot, "start" | "end">): boolean {
  const opened = openWindowStart(discount, slot.start);
  return opened !== null && slot.end.getTime() <= windowEnd(discount, opened).getTime();
}

/** Talabaga taklif qilinadigan kunlar va slotlar: biznes jadvali × chegirma soatlari. Sloti yo'q kun chiqmaydi. */
export function discountSlots(config: BookingConfig, discount: Schedule, now: Date): { date: Date; slots: Slot[] }[] {
  return bookingDays(config, now)
    .map((date) => ({ date, slots: slotsOn(config, date, now).filter((s) => slotInDiscount(discount, s)) }))
    .filter((d) => d.slots.length > 0);
}

/**
 * Nega hozir band qilib bo'lmaydi (talabaga ko'rsatiladi) — bo'lsa null:
 * `full` — slotlar bor, lekin hammasi o'tgan yoki to'lgan; `paused` — "Bugun qabul qilmayman";
 * `hours` — jadval bor, lekin chegirma soatlari/kunlariga to'g'ri kelmaydi; `closed` — bugun (ertaga) jadvalda kun yo'q.
 */
export type BookingBlock = "full" | "paused" | "hours" | "closed" | "payment";

export function bookingBlock(config: BookingConfig, discount: Schedule, now: Date, left: (start: Date) => number): BookingBlock | null {
  const days = discountSlots(config, discount, now);
  if (days.some((d) => d.slots.some((s) => !s.late && left(s.start) > 0))) return null;
  if (days.length > 0) return "full";
  if (config.pausedOn && discountSlots({ ...config, pausedOn: null }, discount, now).length > 0) return "paused";
  return bookingDays(config, now).length > 0 ? "hours" : "closed";
}

// ───────── narx ─────────

export type OrderAmounts = { totalOriginal: number; totalDiscount: number; totalFinal: number; prepayAmount: number };

export function orderAmounts(
  unit: { original: number; final: number },
  quantity: number,
  prepay: { type: (typeof PREPAY_TYPES)[number]; percent: number },
): OrderAmounts {
  const totalOriginal = unit.original * quantity;
  const totalFinal = unit.final * quantity;
  const prepayAmount = prepay.type === "FULL" ? totalFinal : prepay.type === "PARTIAL" ? Math.ceil((totalFinal * prepay.percent) / 100) : 0;
  return { totalOriginal, totalDiscount: totalOriginal - totalFinal, totalFinal, prepayAmount };
}

// ───────── bekor qilish va kelmaslik ─────────

export type MoneyTerms = { prepayAmount: number; freeCancelMinutes: number; keepPercent: number; slotStart: Date };
export type Settlement = { /** Biznesda qoladi (capture) */ keep: number; /** Talabaga qaytadi */ refund: number };

/** Bepul bekor qilish muddati: slotdan `freeCancelMinutes` oldin. */
export const freeCancelUntil = (o: Pick<MoneyTerms, "freeCancelMinutes" | "slotStart">) => new Date(o.slotStart.getTime() - o.freeCancelMinutes * 60_000);

const kept = (o: MoneyTerms) => Math.min(o.prepayAmount, Math.round((o.prepayAmount * o.keepPercent) / 100));

/**
 * Pul qanday taqsimlanadi. Talaba bekor qilsa: muddatgacha — hammasi qaytadi, keyin — `keepPercent` biznesda.
 * Biznes rad etsa yoki tizim bekor qilsa (javobsiz, to'lanmagan) — hammasi qaytadi. Hali to'lanmagan — hech narsa.
 */
export function settlement(order: MoneyTerms & { status: OrderStatus }, by: OrderActor, now: Date): Settlement {
  if (order.status === "PENDING_PAYMENT" || order.prepayAmount === 0) return { keep: 0, refund: 0 };
  if (by !== "student" || now.getTime() <= freeCancelUntil(order).getTime()) return { keep: 0, refund: order.prepayAmount };
  const keep = kept(order);
  return { keep, refund: order.prepayAmount - keep };
}

/** Talaba kelmadi: `keepPercent` biznesda, qolgani qaytadi. */
export function noShowSettlement(order: MoneyTerms): Settlement {
  const keep = kept(order);
  return { keep, refund: order.prepayAmount - keep };
}

/** Berildi: oldindan to'langan hammasi biznesga. */
export const completedSettlement = (order: Pick<MoneyTerms, "prepayAmount">): Settlement => ({ keep: order.prepayAmount, refund: 0 });

// ───────── kod ─────────

export const ORDER_CODE_RE = /^TB-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
