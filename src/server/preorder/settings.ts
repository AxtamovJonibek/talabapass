import "server-only";
import { discountTerms } from "@/lib/discount";
import { paymentProvider } from "@/lib/payments";
import {
  bookingBlock,
  DEFAULT_SETTINGS,
  discountSlots,
  parseSchedule,
  preorderSettingsInput,
  type BookingBlock,
  type BookingConfig,
  type PreorderSettingsInput,
} from "@/lib/preorder";
import { toTashkent, type Schedule } from "@/lib/time";
import type { PreorderSettings } from "@/generated/prisma/client";
import { audit } from "../audit";
import { db } from "../db";
import { ownerBusinessForDiscounts } from "../business/discounts";
import { visibleDiscountWhere } from "../student/feed";

/**
 * Biznesning "Oldindan band qilish" sozlamalari (Biznes → Sozlamalar) va talabaga taklif (qaysi kun/slot bo'sh).
 * Sozlama yo'q/o'chiq, chegirma belgilanmagan yoki narxi aniq emas — talabaga "Band qilish" umuman ko'rinmaydi.
 * Qolgan holatlarda tugma ko'rinadi; hozir band qilib bo'lmasa — o'chiq tugma va sababi (`bookingAvailability`).
 */

export function toInput(row: PreorderSettings | null): PreorderSettingsInput {
  if (!row) return DEFAULT_SETTINGS;
  return {
    enabled: row.enabled,
    mode: row.mode,
    schedule: parseSchedule(row.schedule),
    slotMinutes: row.slotMinutes as PreorderSettingsInput["slotMinutes"],
    slotCapacity: row.slotCapacity,
    leadMinutes: row.leadMinutes,
    daysAhead: row.daysAhead === 0 ? 0 : 1,
    prepay: row.prepay,
    prepayPercent: row.prepayPercent,
    freeCancelMinutes: row.freeCancelMinutes,
    keepPercent: row.keepPercent,
    autoConfirm: row.autoConfirm,
  };
}

export function bookingConfig(row: Pick<PreorderSettings, "schedule" | "slotMinutes" | "leadMinutes" | "daysAhead" | "pausedOn">): BookingConfig {
  return { schedule: parseSchedule(row.schedule), slotMinutes: row.slotMinutes as 15 | 30 | 60, leadMinutes: row.leadMinutes, daysAhead: row.daysAhead === 0 ? 0 : 1, pausedOn: row.pausedOn };
}

/** Narxi aniq chegirma (talaba oldindan to'laydigan summa hisoblanadi). Narxsiz ("chekdan −15%") — band qilib bo'lmaydi. */
export function unitPrice(d: { type: "PERCENT" | "FIXED_PRICE" | "BOGO"; originalPrice: number | null; percent: number | null; newPrice: number | null }) {
  const terms = discountTerms(d);
  return terms.finalPrice !== null && terms.originalPrice !== null && terms.finalPrice > 0 ? { original: terms.originalPrice, final: terms.finalPrice } : null;
}

export type OwnerPreorder = {
  businessId: string;
  settings: PreorderSettingsInput;
  pausedToday: boolean;
  discounts: { id: string; title: string; preorder: boolean; price: { original: number; final: number } | null; status: string; schedule: Schedule }[];
};

export async function ownerPreorder(ownerId: string, now = new Date()): Promise<OwnerPreorder | null> {
  const business = await ownerBusinessForDiscounts(ownerId);
  if (!business) return null;
  const [row, discounts] = await Promise.all([
    db.preorderSettings.findUnique({ where: { businessId: business.id } }),
    db.discount.findMany({
      where: { businessId: business.id, status: { in: ["ACTIVE", "PENDING_REVIEW", "PAUSED", "DRAFT"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        preorder: true,
        status: true,
        type: true,
        originalPrice: true,
        percent: true,
        newPrice: true,
        weekdays: true,
        fromMinute: true,
        toMinute: true,
        startsOn: true,
        endsOn: true,
      },
    }),
  ]);
  return {
    businessId: business.id,
    settings: toInput(row),
    pausedToday: row?.pausedOn?.getTime() === toTashkent(now).date.getTime(),
    discounts: discounts.map((d) => ({
      id: d.id,
      title: d.title,
      preorder: d.preorder,
      status: d.status,
      price: unitPrice(d),
      schedule: { weekdays: d.weekdays, fromMinute: d.fromMinute, toMinute: d.toMinute, startsOn: d.startsOn, endsOn: d.endsOn },
    })),
  };
}

export type SaveSettingsResult = { ok: true } | { ok: false; error: "noBusiness" | "invalid" | "noSchedule" };

export async function savePreorderSettings(ownerId: string, raw: unknown): Promise<SaveSettingsResult> {
  const business = await ownerBusinessForDiscounts(ownerId);
  if (!business) return { ok: false, error: "noBusiness" };
  const parsed = preorderSettingsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  if (input.enabled && input.schedule.length === 0) return { ok: false, error: "noSchedule" };
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

/** Chegirmadagi "Oldindan band qilish mumkin" belgisi (mazmun emas — qayta tekshiruvsiz). */
export async function setDiscountPreorder(ownerId: string, discountId: string, on: boolean): Promise<boolean> {
  const discount = await db.discount.findFirst({
    where: { id: discountId, business: { ownerId } },
    select: { id: true, type: true, originalPrice: true, percent: true, newPrice: true },
  });
  if (!discount || (on && !unitPrice(discount))) return false;
  await db.$transaction(async (tx) => {
    await tx.discount.update({ where: { id: discount.id }, data: { preorder: on } });
    await audit({ actorId: ownerId, action: "discount.preorder", entity: "Discount", entityId: discount.id, meta: { preorder: on } }, tx);
  });
  return true;
}

// ───────── talabaga taklif ─────────

export type BookingSlot = { start: string; end: string; left: number; disabled: boolean };
export type BookingOffer = {
  discountId: string;
  businessName: string;
  title: string;
  modes: ("PICKUP" | "DINE_IN")[];
  unit: { original: number; final: number };
  prepay: PreorderSettingsInput["prepay"];
  prepayPercent: number;
  freeCancelMinutes: number;
  keepPercent: number;
  autoConfirm: boolean;
  days: { date: string; slots: BookingSlot[] }[];
};

const BOOKABLE_SELECT = {
  id: true,
  title: true,
  preorder: true,
  type: true,
  originalPrice: true,
  percent: true,
  newPrice: true,
  weekdays: true,
  fromMinute: true,
  toMinute: true,
  startsOn: true,
  endsOn: true,
  businessId: true,
  business: { select: { name: true, preorder: true } },
} as const;

/** Chegirma band qilinadimi: biznes sozlamasi yoqilgan, chegirma belgilangan, talabaga ko'rinadi, narxi aniq. */
export async function bookableDiscount(discountId: string, now = new Date()) {
  const discount = await db.discount.findFirst({ where: { AND: [{ id: discountId, preorder: true }, visibleDiscountWhere(now)] }, select: BOOKABLE_SELECT });
  const settings = discount?.business.preorder;
  const unit = discount ? unitPrice(discount) : null;
  if (!discount || !settings?.enabled || !unit) return null;
  return { discount, settings, unit };
}

/** Band qilingan joylar: slot boshi → band soni */
async function slotUsage(businessId: string, starts: Date[]): Promise<Map<number, number>> {
  if (starts.length === 0) return new Map();
  const rows = await db.preorderSlot.findMany({ where: { businessId, startsAt: { in: starts } }, select: { startsAt: true, booked: true } });
  return new Map(rows.map((r) => [r.startsAt.getTime(), r.booked]));
}

export async function bookingOffer(discountId: string, now = new Date()): Promise<BookingOffer | null> {
  const found = await bookableDiscount(discountId, now);
  if (!found) return null;
  const { discount, settings, unit } = found;
  const days = discountSlots(bookingConfig(settings), discount, now);
  if (days.length === 0) return null;
  const used = await slotUsage(discount.businessId, days.flatMap((d) => d.slots.map((s) => s.start)));
  return {
    discountId: discount.id,
    businessName: discount.business.name,
    title: discount.title,
    modes: settings.mode === "BOTH" ? ["PICKUP", "DINE_IN"] : [settings.mode],
    unit,
    prepay: settings.prepay,
    prepayPercent: settings.prepayPercent,
    freeCancelMinutes: settings.freeCancelMinutes,
    keepPercent: settings.keepPercent,
    autoConfirm: settings.autoConfirm,
    days: days.map(({ date, slots }) => ({
      date: date.toISOString().slice(0, 10),
      slots: slots.map((s) => {
        const left = Math.max(0, settings.slotCapacity - (used.get(s.start.getTime()) ?? 0));
        return { start: s.start.toISOString(), end: s.end.toISOString(), left, disabled: s.late || left === 0 };
      }),
    })),
  };
}

export type BookingAvailability = { open: true } | { open: false; reason: BookingBlock };

/**
 * Chegirma sahifasidagi tugma uchun. null — tugma umuman yo'q (funksiya o'chiq, chegirma belgilanmagan, narxsiz);
 * aks holda ochiq yoki sababi bilan yopiq ("Hozir bo'sh slot yo'q" va h.k.) — jimgina yashirilmaydi.
 */
export async function bookingAvailability(discountId: string, now = new Date()): Promise<BookingAvailability | null> {
  const found = await bookableDiscount(discountId, now);
  if (!found) return null;
  const { discount, settings } = found;
  if (settings.prepay !== "NONE" && !paymentProvider()) return { open: false, reason: "payment" };
  const config = bookingConfig(settings);
  const used = await slotUsage(discount.businessId, discountSlots(config, discount, now).flatMap((d) => d.slots.map((s) => s.start)));
  const reason = bookingBlock(config, discount, now, (start) => settings.slotCapacity - (used.get(start.getTime()) ?? 0));
  return reason ? { open: false, reason } : { open: true };
}
