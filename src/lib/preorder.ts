import { z } from "zod";
import { fromTashkent, openWindowStart, toTashkent, weekdayOf, windowEnd, type Schedule } from "./time";

/**
 * Oldindan band qilish: rejimlar, holat mashinasi, sozlamalar, slotlar/oynalar, narx va bekor qilish qoidasi. Sof mantiq —
 * forma, server va testlar bitta koddan foydalanadi. Pul — butun so'm, vaqt — Toshkent (UTC+5).
 *
 * Rejim chegirmada (`Discount.bookingMode`): APPOINTMENT — vaqtli uchrashuv (slot = xizmat davomiyligi, sig'im = mutaxassislar);
 * PREPAID_PICKUP — to'lab, muddat ichida istalgan vaqtda olib ketish (zaxira); PICKUP_WINDOW — bugun/ertaga kunlik oynada olib ketish.
 */

export const BOOKING_KINDS = ["APPOINTMENT", "PREPAID_PICKUP", "PICKUP_WINDOW"] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];
export type BookingMode = BookingKind | "NONE";

// ───────── holatlar ─────────

export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "READY", "COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW", "EXPIRED"] as const;
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
    EXPIRED: ["CONFIRMED", "READY"],
  },
};

/** Faqat ba'zi rejimlarga tegishli holatlar: slot/oyna o'tsa — "Kelmadi", muddat o'tsa — "Muddati tugadi". */
const KIND_ONLY: Partial<Record<OrderStatus, readonly BookingKind[]>> = {
  NO_SHOW: ["APPOINTMENT", "PICKUP_WINDOW"],
  EXPIRED: ["PREPAID_PICKUP"],
};

export function allowedFrom(actor: OrderActor, to: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[actor][to] ?? [];
}

export function canTransition(actor: OrderActor, from: OrderStatus, to: OrderStatus, kind?: BookingKind): boolean {
  const only = KIND_ONLY[to];
  if (kind && only && !only.includes(kind)) return false;
  return allowedFrom(actor, to).includes(from);
}

export const FINAL_STATUSES: readonly OrderStatus[] = ["COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW", "EXPIRED"];

/**
 * Buyurtma yopilganda sig'im qaytadimi: slot/oyna joyi — bekor yoki rad etilganda (kelmagan talabaning vaqti o'tgan);
 * zaxira — bekor, rad etilgan va muddati o'tganda (mahsulot do'konda qoldi).
 */
export function releasesCapacity(kind: BookingKind, to: OrderStatus): boolean {
  if (to === "REJECTED" || to === "CANCELLED") return true;
  return kind === "PREPAID_PICKUP" && to === "EXPIRED";
}

/** Sig'imdan nechta birlik oladi: uchrashuv — bitta joy, oyna va zaxira — dona. */
export const capacityUnits = (kind: BookingKind, quantity: number) => (kind === "APPOINTMENT" ? 1 : quantity);
/** Biznes panelidagi filtrlar */
export const ORDER_FILTERS = {
  new: ["PAID"],
  preparing: ["CONFIRMED"],
  ready: ["READY"],
  done: ["COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW", "EXPIRED"],
} as const satisfies Record<string, readonly OrderStatus[]>;
export type OrderFilter = keyof typeof ORDER_FILTERS;

// ───────── sozlamalar ─────────

export const PREPAY_TYPES = ["FULL", "PARTIAL", "NONE"] as const;
export const QUANTITY_MAX = 20;
export const NOTE_MAX = 200;
/** Qo'lda tasdiqlashda biznes javob berishi kerak bo'lgan vaqt */
export const CONFIRM_TIMEOUT_MS = 10 * 60_000;
/** To'lov sahifasida kutish (to'lanmasa joy bo'shaydi) */
export const PAYMENT_TIMEOUT_MS = 15 * 60_000;
/** Slot/oyna tugagach shuncha kutiladi, keyin "Kelmadi" */
export const NO_SHOW_GRACE_MS = 15 * 60_000;
/** PREPAID_PICKUP: muddat tugashidan shuncha kun oldin eslatma */
export const EXPIRY_REMINDER_DAYS = [2, 1] as const;

const minute = z.number().int().min(0).max(1440);
export const daySchedule = z
  .object({ day: z.number().int().min(1).max(7), from: minute, to: minute })
  .refine((d) => d.to > d.from, { message: "range" });
export type DaySchedule = z.infer<typeof daySchedule>;

export const preorderSettingsInput = z.object({
  enabled: z.boolean(),
  schedule: z
    .array(daySchedule)
    .max(7)
    .refine((list) => new Set(list.map((d) => d.day)).size === list.length, { message: "duplicate" }),
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
  schedule: DEFAULT_SCHEDULE,
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

/** Slot va oyna hisobi uchun: biznes jadvali va qoidalari + chegirmadagi slot uzunligi (xizmat davomiyligi). */
export type BookingConfig = Pick<PreorderSettingsInput, "schedule" | "leadMinutes" | "daysAhead"> & {
  slotMinutes: number;
  /** "Bugun qabul qilmayman" — shu Toshkent sanasi (UTC yarim tun) */
  pausedOn: Date | null;
};

// ───────── chegirmadagi rejim ─────────

export const SERVICE_MINUTES = { min: 5, max: 480 } as const;
export const STAFF_MAX = 20;
export const VALID_DAYS_MAX = 60;
export const PER_STUDENT_MAX = 20;

/** Chegirmaning band qilish maydonlari (forma va server bitta). Faqat tanlangan rejimniki ishlatiladi, qolganlari saqlanib turadi. */
export const discountBookingInput = z
  .object({
    bookingMode: z.enum(["NONE", ...BOOKING_KINDS]),
    serviceMinutes: z.number().int().min(SERVICE_MINUTES.min).max(SERVICE_MINUTES.max),
    staffCount: z.number().int().min(1).max(STAFF_MAX),
    validDays: z.number().int().min(1).max(VALID_DAYS_MAX),
    stock: z.number().int().min(0).max(100_000),
    perStudentMax: z.number().int().min(1).max(PER_STUDENT_MAX),
    expireKeepPercent: z.number().int().min(0).max(100),
    windowFrom: minute,
    windowTo: minute,
    windowCapacity: z.number().int().min(1).max(500),
  })
  .refine((d) => d.windowTo > d.windowFrom, { message: "window", path: ["windowTo"] });
export type DiscountBooking = z.infer<typeof discountBookingInput>;

export const DEFAULT_DISCOUNT_BOOKING: DiscountBooking = {
  bookingMode: "NONE",
  serviceMinutes: 30,
  staffCount: 1,
  validDays: 7,
  stock: 0,
  perStudentMax: 2,
  expireKeepPercent: 0,
  windowFrom: 14 * 60,
  windowTo: 20 * 60,
  windowCapacity: 20,
};

/** Rejimga qarab oldindan to'lov: PREPAID_PICKUP — har doim to'liq (to'lab qo'yiladi), qolganlari — biznes sozlamasidan. */
export const prepayFor = (kind: BookingKind, settings: { prepay: (typeof PREPAY_TYPES)[number]; prepayPercent: number }) =>
  kind === "PREPAID_PICKUP" ? { type: "FULL" as const, percent: 100 } : { type: settings.prepay, percent: settings.prepayPercent };

/** Bir buyurtmada eng ko'p: uchrashuv — 1, qolganlari — talaba chegarasi. */
export const quantityMax = (kind: BookingKind, perStudentMax: number) => (kind === "APPOINTMENT" ? 1 : Math.min(QUANTITY_MAX, perStudentMax));

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
 * `hours` — jadval bor, lekin chegirma soatlari/kunlariga to'g'ri kelmaydi; `closed` — bugun (ertaga) jadvalda kun yo'q;
 * `payment` — to'lov provayderi yo'q; `soldOut` — zaxira tugagan (PREPAID_PICKUP); `limit` — talaba o'z chegarasini olib bo'lgan.
 */
export type BookingBlock = "full" | "paused" | "hours" | "closed" | "payment" | "soldOut" | "limit";

export function bookingBlock(config: BookingConfig, discount: Schedule, now: Date, left: (start: Date) => number): BookingBlock | null {
  const days = discountSlots(config, discount, now);
  if (days.some((d) => d.slots.some((s) => !s.late && left(s.start) > 0))) return null;
  if (days.length > 0) return "full";
  if (config.pausedOn && discountSlots({ ...config, pausedOn: null }, discount, now).length > 0) return "paused";
  return bookingDays(config, now).length > 0 ? "hours" : "closed";
}

// ───────── kunlik oyna (PICKUP_WINDOW) ─────────

export type PickupWindow = { date: Date; start: Date; end: Date; /** Tayyorlashga vaqt qolmagan (oyna tugashidan `leadMinutes` oldin yopiladi) */ late: boolean };
type WindowConfig = Pick<BookingConfig, "daysAhead" | "leadMinutes" | "pausedOn">;

/** Bugun (+ ertaga) olib ketish oynalari: to'xtatilmagan va chegirma oralig'i ichidagi kunlar. Biznes jadvali bu rejimga ta'sir qilmaydi. */
export function pickupWindows(config: WindowConfig, discount: Schedule, window: { from: number; to: number }, now: Date): PickupWindow[] {
  const today = toTashkent(now).date;
  const out: PickupWindow[] = [];
  for (let i = 0; i <= config.daysAhead; i++) {
    const date = new Date(today.getTime() + i * DAY_MS);
    if (config.pausedOn && config.pausedOn.getTime() === date.getTime()) continue;
    const start = fromTashkent(date, window.from);
    const end = fromTashkent(date, window.to);
    if (!slotInDiscount(discount, { start, end })) continue;
    out.push({ date, start, end, late: now.getTime() + config.leadMinutes * 60_000 > end.getTime() });
  }
  return out;
}

/** Oyna rejimida nega band qilib bo'lmaydi (bo'lsa null). `left` — shu oynadagi bo'sh dona. */
export function windowBlock(config: WindowConfig, discount: Schedule, window: { from: number; to: number }, now: Date, left: (start: Date) => number): BookingBlock | null {
  const windows = pickupWindows(config, discount, window, now);
  if (windows.some((w) => !w.late && left(w.start) > 0)) return null;
  if (windows.length > 0) return "full";
  if (config.pausedOn && pickupWindows({ ...config, pausedOn: null }, discount, window, now).length > 0) return "paused";
  return "hours";
}

// ───────── to'lab olib ketish (PREPAID_PICKUP) ─────────

/** Muddat oxiri: bugundan boshlab `validDays` kun (oxirgi kun tugaguncha, Toshkent vaqti). */
export const prepaidExpiry = (now: Date, validDays: number) => fromTashkent(new Date(toTashkent(now).date.getTime() + validDays * DAY_MS), 0);

/**
 * Pul ushlab turiladimi yoki darhol yechiladimi: buyurtma provayder ushlab tura oladigan muddatdan (`holdMaxDays`)
 * uzoq yashasa — darhol capture, qaytarish keyin refund orqali.
 */
export const captureOnPay = (holdUntil: Date, now: Date, holdMaxDays: number | undefined) =>
  holdMaxDays !== undefined && holdUntil.getTime() - now.getTime() > holdMaxDays * DAY_MS;

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

/** Muddati o'tdi (PREPAID_PICKUP): kelmaslik kabi — `keepPercent` (chegirmadagi `expireKeepPercent` nusxasi) biznesda. */
export const expiredSettlement = noShowSettlement;

/** Berildi: oldindan to'langan hammasi biznesga. */
export const completedSettlement = (order: Pick<MoneyTerms, "prepayAmount">): Settlement => ({ keep: order.prepayAmount, refund: 0 });

// ───────── kod ─────────

export const ORDER_CODE_RE = /^TB-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
