import "server-only";
import { discountTerms } from "@/lib/discount";
import { paymentProvider } from "@/lib/payments";
import {
  bookingBlock,
  DEFAULT_SETTINGS,
  discountBookingInput,
  discountSlots,
  parseSchedule,
  pickupWindows,
  prepaidExpiry,
  prepayFor,
  preorderSettingsInput,
  quantityMax,
  windowBlock,
  type BookingBlock,
  type BookingConfig,
  type BookingKind,
  type DiscountBooking,
  type PreorderSettingsInput,
} from "@/lib/preorder";
import { toTashkent, type Schedule } from "@/lib/time";
import type { PreorderSettings } from "@/generated/prisma/client";
import { audit } from "../audit";
import { db } from "../db";
import { ownerBusinessForDiscounts } from "../business/discounts";
import { PREORDER_ALLOWED, permissionsOf } from "../business/permissions";
import { visibleDiscountWhere } from "../student/feed";

/**
 * Biznesning "Oldindan band qilish" sozlamalari (Biznes → Sozlamalar): umumiy (yoqish, ish jadvali, to'lov, bekor qilish,
 * tasdiqlash) — biznesda; rejim va uning maydonlari — har chegirmada. Talabaga taklif va tugma holati ham shu yerda.
 * Sozlama yo'q/o'chiq, chegirmada rejim yo'q yoki narxi aniq emas — talabaga tugma umuman ko'rinmaydi.
 * Qolgan holatlarda tugma ko'rinadi; hozir band qilib bo'lmasa — o'chiq tugma va sababi (`bookingAvailability`).
 */

export function toInput(row: PreorderSettings | null): PreorderSettingsInput {
  if (!row) return DEFAULT_SETTINGS;
  return {
    enabled: row.enabled,
    schedule: parseSchedule(row.schedule),
    leadMinutes: row.leadMinutes,
    daysAhead: row.daysAhead === 0 ? 0 : 1,
    prepay: row.prepay,
    prepayPercent: row.prepayPercent,
    freeCancelMinutes: row.freeCancelMinutes,
    keepPercent: row.keepPercent,
    autoConfirm: row.autoConfirm,
  };
}

/** Slot hisobi: biznes jadvali + chegirmadagi xizmat davomiyligi (slot uzunligi). */
export function bookingConfig(row: Pick<PreorderSettings, "schedule" | "leadMinutes" | "daysAhead" | "pausedOn">, slotMinutes: number): BookingConfig {
  return { schedule: parseSchedule(row.schedule), slotMinutes, leadMinutes: row.leadMinutes, daysAhead: row.daysAhead === 0 ? 0 : 1, pausedOn: row.pausedOn };
}

/** Narxi aniq chegirma (talaba oldindan to'laydigan summa hisoblanadi). Narxsiz ("chekdan −15%") — band qilib bo'lmaydi. */
export function unitPrice(d: { type: "PERCENT" | "FIXED_PRICE" | "BOGO"; originalPrice: number | null; percent: number | null; newPrice: number | null }) {
  const terms = discountTerms(d);
  return terms.finalPrice !== null && terms.originalPrice !== null && terms.finalPrice > 0 ? { original: terms.originalPrice, final: terms.finalPrice } : null;
}

const BOOKING_FIELDS = {
  bookingMode: true,
  serviceMinutes: true,
  staffCount: true,
  validDays: true,
  stock: true,
  perStudentMax: true,
  expireKeepPercent: true,
  windowFrom: true,
  windowTo: true,
  windowCapacity: true,
} as const;

const SCHEDULE_FIELDS = { weekdays: true, fromMinute: true, toMinute: true, startsOn: true, endsOn: true } as const;
const PRICE_FIELDS = { type: true, originalPrice: true, percent: true, newPrice: true } as const;

const scheduleOf = (d: Schedule): Schedule => ({ weekdays: d.weekdays, fromMinute: d.fromMinute, toMinute: d.toMinute, startsOn: d.startsOn, endsOn: d.endsOn });
const bookingOf = (d: DiscountBooking): DiscountBooking => ({
  bookingMode: d.bookingMode,
  serviceMinutes: d.serviceMinutes,
  staffCount: d.staffCount,
  validDays: d.validDays,
  stock: d.stock,
  perStudentMax: d.perStudentMax,
  expireKeepPercent: d.expireKeepPercent,
  windowFrom: d.windowFrom,
  windowTo: d.windowTo,
  windowCapacity: d.windowCapacity,
});

export type OwnerDiscount = {
  id: string;
  title: string;
  status: string;
  price: { original: number; final: number } | null;
  schedule: Schedule;
  booking: DiscountBooking;
};

export type OwnerPreorder = {
  businessId: string;
  settings: PreorderSettingsInput;
  pausedToday: boolean;
  discounts: OwnerDiscount[];
};

export async function ownerPreorder(ownerId: string, now = new Date()): Promise<OwnerPreorder | null> {
  const business = await ownerBusinessForDiscounts(ownerId);
  if (!business) return null;
  const [row, discounts] = await Promise.all([
    db.preorderSettings.findUnique({ where: { businessId: business.id } }),
    db.discount.findMany({
      where: { businessId: business.id, status: { in: ["ACTIVE", "PENDING_REVIEW", "PAUSED", "DRAFT"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, ...PRICE_FIELDS, ...SCHEDULE_FIELDS, ...BOOKING_FIELDS },
    }),
  ]);
  return {
    businessId: business.id,
    settings: toInput(row),
    pausedToday: row?.pausedOn?.getTime() === toTashkent(now).date.getTime(),
    discounts: discounts.map((d) => ({ id: d.id, title: d.title, status: d.status, price: unitPrice(d), schedule: scheduleOf(d), booking: bookingOf(d) })),
  };
}

export type SaveSettingsResult = { ok: true } | { ok: false; error: "noBusiness" | "invalid" | "noSchedule" | "noPermission" };

export async function savePreorderSettings(ownerId: string, raw: unknown): Promise<SaveSettingsResult> {
  const business = await ownerBusinessForDiscounts(ownerId);
  if (!business) return { ok: false, error: "noBusiness" };
  const parsed = preorderSettingsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  if (input.enabled && input.schedule.length === 0) return { ok: false, error: "noSchedule" };
  if (input.enabled && !(await permissionsOf(business.id)).canPreorder) return { ok: false, error: "noPermission" };
  const data = { ...input, schedule: input.schedule.sort((a, b) => a.day - b.day) };
  await db.$transaction(async (tx) => {
    await tx.preorderSettings.upsert({ where: { businessId: business.id }, create: { businessId: business.id, ...data }, update: data });
    await audit({ actorId: ownerId, action: "preorder.settings", entity: "Business", entityId: business.id, meta: data }, tx);
  });
  return { ok: true };
}

/** "Bugun qabul qilmayman" — yoqilsa shu Toshkent kuni yangi buyurtma olinmaydi (mavjudlari o'z holicha). */
export async function setPreorderPaused(ownerId: string, paused: boolean, now = new Date()): Promise<boolean> {
  const business = await ownerBusinessForDiscounts(ownerId);
  if (!business) return false;
  const pausedOn = paused ? toTashkent(now).date : null;
  await db.$transaction(async (tx) => {
    await tx.preorderSettings.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...DEFAULT_SETTINGS, pausedOn },
      update: { pausedOn },
    });
    await audit({ actorId: ownerId, action: paused ? "preorder.pause" : "preorder.resume", entity: "Business", entityId: business.id }, tx);
  });
  return true;
}

export type SaveDiscountBookingResult = { ok: true } | { ok: false; error: "notFound" | "invalid" | "noPrice" };

/** Chegirmaning band qilish rejimi va maydonlari (mazmun emas — qayta tekshiruvsiz). Audit'da oldin → keyin. */
export async function saveDiscountBooking(ownerId: string, discountId: string, raw: unknown): Promise<SaveDiscountBookingResult> {
  const parsed = discountBookingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const discount = await db.discount.findFirst({ where: { id: discountId, business: { ownerId } }, select: { id: true, ...PRICE_FIELDS, ...BOOKING_FIELDS } });
  if (!discount) return { ok: false, error: "notFound" };
  if (parsed.data.bookingMode !== "NONE" && !unitPrice(discount)) return { ok: false, error: "noPrice" };
  const data = bookingOf(parsed.data);
  await db.$transaction(async (tx) => {
    await tx.discount.update({ where: { id: discount.id }, data });
    await audit({ actorId: ownerId, action: "discount.booking", entity: "Discount", entityId: discount.id, meta: { before: bookingOf(discount), after: data } }, tx);
  });
  return { ok: true };
}

// ───────── talabaga taklif ─────────

export type BookingSlot = { start: string; end: string; left: number; disabled: boolean };
export type BookingOffer = {
  kind: BookingKind;
  discountId: string;
  businessName: string;
  workingHours: string;
  title: string;
  unit: { original: number; final: number };
  prepay: PreorderSettingsInput["prepay"];
  prepayPercent: number;
  freeCancelMinutes: number;
  /** Kech bekor qilinsa / kelmasa (PREPAID_PICKUP — muddat o'tsa yoki bekor qilinsa) biznesda qoladigan ulush */
  keepPercent: number;
  autoConfirm: boolean;
  /** Bir buyurtmada eng ko'p (talabaning qolgan chegarasi va zaxira bilan) */
  maxQuantity: number;
  /** APPOINTMENT: kunlar va slotlar */
  days: { date: string; slots: BookingSlot[] }[];
  /** PICKUP_WINDOW: bugun/ertangi oynalar (`left` — bo'sh dona) */
  windows: (BookingSlot & { date: string })[];
  /** PREPAID_PICKUP: muddat va zaxira */
  prepaid: { validDays: number; validUntil: string; stockLeft: number } | null;
};

const BOOKABLE_SELECT = {
  id: true,
  title: true,
  businessId: true,
  ...PRICE_FIELDS,
  ...SCHEDULE_FIELDS,
  ...BOOKING_FIELDS,
  business: { select: { name: true, workingHours: true, preorder: true } },
} as const;

/** Chegirma band qilinadimi: biznes sozlamasi yoqilgan, chegirmada rejim tanlangan, talabaga ko'rinadi, narxi aniq. */
export async function bookableDiscount(discountId: string, now = new Date()) {
  // Admin `canPreorder` ni o'chirgan biznesda band qilish yo'q (tugma ham chiqmaydi)
  const discount = await db.discount.findFirst({
    where: { AND: [{ id: discountId, bookingMode: { not: "NONE" }, business: PREORDER_ALLOWED }, visibleDiscountWhere(now)] },
    select: BOOKABLE_SELECT,
  });
  const settings = discount?.business.preorder;
  const unit = discount ? unitPrice(discount) : null;
  if (!discount || !settings?.enabled || !unit || discount.bookingMode === "NONE") return null;
  return { discount, settings, unit, kind: discount.bookingMode as BookingKind };
}
export type Bookable = NonNullable<Awaited<ReturnType<typeof bookableDiscount>>>;

/** Band qilingan joylar (chegirma × slot/oyna boshi) → band soni */
async function seatUsage(discountId: string, starts: Date[]): Promise<Map<number, number>> {
  if (starts.length === 0) return new Map();
  const rows = await db.bookingSeat.findMany({ where: { discountId, startsAt: { in: starts } }, select: { startsAt: true, booked: true } });
  return new Map(rows.map((r) => [r.startsAt.getTime(), r.booked]));
}

/** Talaba shu chegirmadan olgan (bekor/rad/muddati o'tganlarsiz) dona */
export async function studentUnits(studentId: string, discountId: string): Promise<number> {
  const sum = await db.order.aggregate({ where: { studentId, discountId, status: { notIn: ["CANCELLED", "REJECTED", "EXPIRED"] } }, _sum: { quantity: true } });
  return sum._sum.quantity ?? 0;
}

/** Talabaga hozir nechta dona mumkin (uchrashuv — 1; qolganlari — chegara, o'zi olgani va zaxira bilan) */
async function allowedUnits(found: Bookable, studentId: string | null): Promise<number> {
  const { discount, kind } = found;
  if (kind === "APPOINTMENT") return 1;
  const left = discount.perStudentMax - (studentId ? await studentUnits(studentId, discount.id) : 0);
  const max = Math.min(quantityMax(kind, discount.perStudentMax), left);
  return Math.max(0, kind === "PREPAID_PICKUP" ? Math.min(max, discount.stock) : max);
}

export async function bookingOffer(discountId: string, studentId: string | null, now = new Date()): Promise<BookingOffer | null> {
  const found = await bookableDiscount(discountId, now);
  if (!found) return null;
  const { discount, settings, unit, kind } = found;
  const prepay = prepayFor(kind, settings);
  const base = {
    kind,
    discountId: discount.id,
    businessName: discount.business.name,
    workingHours: discount.business.workingHours,
    title: discount.title,
    unit,
    prepay: prepay.type,
    prepayPercent: prepay.percent,
    freeCancelMinutes: kind === "PREPAID_PICKUP" ? 0 : settings.freeCancelMinutes,
    keepPercent: kind === "PREPAID_PICKUP" ? discount.expireKeepPercent : settings.keepPercent,
    autoConfirm: settings.autoConfirm,
    maxQuantity: await allowedUnits(found, studentId),
    days: [] as BookingOffer["days"],
    windows: [] as BookingOffer["windows"],
    prepaid: null as BookingOffer["prepaid"],
  };
  if (base.maxQuantity === 0) return null;

  if (kind === "APPOINTMENT") {
    const days = discountSlots(bookingConfig(settings, discount.serviceMinutes), discount, now);
    if (days.length === 0) return null;
    const used = await seatUsage(discount.id, days.flatMap((d) => d.slots.map((s) => s.start)));
    base.days = days.map(({ date, slots }) => ({
      date: date.toISOString().slice(0, 10),
      slots: slots.map((s) => {
        const left = Math.max(0, discount.staffCount - (used.get(s.start.getTime()) ?? 0));
        return { start: s.start.toISOString(), end: s.end.toISOString(), left, disabled: s.late || left === 0 };
      }),
    }));
    return base;
  }
  if (kind === "PICKUP_WINDOW") {
    const windows = pickupWindows(bookingConfig(settings, 0), discount, { from: discount.windowFrom, to: discount.windowTo }, now);
    if (windows.length === 0) return null;
    const used = await seatUsage(discount.id, windows.map((w) => w.start));
    base.windows = windows.map((w) => {
      const left = Math.max(0, discount.windowCapacity - (used.get(w.start.getTime()) ?? 0));
      return { date: w.date.toISOString().slice(0, 10), start: w.start.toISOString(), end: w.end.toISOString(), left, disabled: w.late || left === 0 };
    });
    return base;
  }
  if (settings.pausedOn?.getTime() === toTashkent(now).date.getTime()) return null;
  base.prepaid = { validDays: discount.validDays, validUntil: prepaidExpiry(now, discount.validDays).toISOString(), stockLeft: discount.stock };
  return base;
}

export type BookingAvailability = { kind: BookingKind; open: true } | { kind: BookingKind; open: false; reason: BookingBlock };

/**
 * Chegirma sahifasidagi tugma uchun. null — tugma umuman yo'q (funksiya o'chiq, rejim tanlanmagan, narxsiz);
 * aks holda ochiq yoki sababi bilan yopiq ("Hozir bo'sh slot yo'q", "Zaxira tugadi" va h.k.) — jimgina yashirilmaydi.
 */
export async function bookingAvailability(discountId: string, studentId: string | null, now = new Date()): Promise<BookingAvailability | null> {
  const found = await bookableDiscount(discountId, now);
  if (!found) return null;
  const { discount, settings, kind } = found;
  const closed = (reason: BookingBlock): BookingAvailability => ({ kind, open: false, reason });
  if (prepayFor(kind, settings).type !== "NONE" && !paymentProvider()) return closed("payment");

  let reason: BookingBlock | null;
  if (kind === "APPOINTMENT") {
    const config = bookingConfig(settings, discount.serviceMinutes);
    const used = await seatUsage(discount.id, discountSlots(config, discount, now).flatMap((d) => d.slots.map((s) => s.start)));
    reason = bookingBlock(config, discount, now, (start) => discount.staffCount - (used.get(start.getTime()) ?? 0));
  } else if (kind === "PICKUP_WINDOW") {
    const config = bookingConfig(settings, 0);
    const window = { from: discount.windowFrom, to: discount.windowTo };
    const used = await seatUsage(discount.id, pickupWindows(config, discount, window, now).map((w) => w.start));
    reason = windowBlock(config, discount, window, now, (start) => discount.windowCapacity - (used.get(start.getTime()) ?? 0));
  } else {
    reason = discount.stock <= 0 ? "soldOut" : settings.pausedOn?.getTime() === toTashkent(now).date.getTime() ? "paused" : null;
  }
  if (!reason && kind !== "APPOINTMENT" && (await allowedUnits(found, studentId)) === 0) reason = "limit";
  return reason ? closed(reason) : { kind, open: true };
}
