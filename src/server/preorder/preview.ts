import "server-only";
import { z } from "zod";
import {
  bookingBlock,
  discountBookingInput,
  discountSlots,
  orderAmounts,
  pickupWindows,
  prepaidExpiry,
  prepayFor,
  preorderSettingsInput,
  quantityMax,
  windowBlock,
  type BookingKind,
} from "@/lib/preorder";
import { toTashkent } from "@/lib/time";
import { ownerPreorder } from "./settings";

export const previewInput = z.object({
  settings: preorderSettingsInput,
  paused: z.boolean(),
  discountId: z.string().min(1).max(40),
  draft: discountBookingInput,
});

/**
 * Sozlamalardagi jonli preview (saytdagi `StudentPreview` va `DiscountBookingEditor` dagi `offHours` bilan bir xil hisob,
 * `src/lib/preorder`): saqlanmagan qoidalar va chegirma rejimi bilan talaba nimani ko'rishi. Ilova hisobni takrorlamaydi.
 */
export async function bookingPreview(ownerId: string, input: z.infer<typeof previewInput>, now = new Date()) {
  const data = await ownerPreorder(ownerId, now);
  const discount = data?.discounts.find((d) => d.id === input.discountId);
  if (!discount) return null;
  const { settings, draft } = input;
  const mode = draft.bookingMode;
  const offHours =
    mode === "APPOINTMENT"
      ? bookingBlock({ ...settings, slotMinutes: draft.serviceMinutes, pausedOn: null }, discount.schedule, now, () => draft.staffCount) === "hours"
      : mode === "PICKUP_WINDOW"
        ? windowBlock({ ...settings, pausedOn: null }, discount.schedule, { from: draft.windowFrom, to: draft.windowTo }, now, () => draft.windowCapacity) === "hours"
        : false;
  if (mode === "NONE" || !discount.price) return { kind: null, offHours };

  const kind: BookingKind = mode;
  const pausedOn = input.paused ? toTashkent(now).date : null;
  const prepay = prepayFor(kind, settings);
  const amounts = orderAmounts(discount.price, 1, prepay);
  const iso = (d: Date) => d.toISOString();
  const days =
    kind === "APPOINTMENT"
      ? discountSlots({ ...settings, slotMinutes: draft.serviceMinutes, pausedOn }, discount.schedule, now).map((d) => ({
          date: iso(d.date),
          slots: d.slots.map((s) => ({ start: iso(s.start), late: s.late })),
        }))
      : [];
  const windows =
    kind === "PICKUP_WINDOW"
      ? pickupWindows({ ...settings, pausedOn }, discount.schedule, { from: draft.windowFrom, to: draft.windowTo }, now).map((w) => ({
          date: iso(w.date),
          start: iso(w.start),
          late: w.late,
        }))
      : [];
  return {
    kind,
    offHours,
    title: discount.title,
    days,
    windows,
    quantity: kind === "PREPAID_PICKUP" ? Math.min(quantityMax(kind, draft.perStudentMax), Math.max(draft.stock, 0)) : null,
    amounts: { totalFinal: amounts.totalFinal, prepayAmount: amounts.prepayAmount },
    prepay: prepay.type,
    rules: {
      freeCancelMinutes: kind === "PREPAID_PICKUP" ? 0 : settings.freeCancelMinutes,
      keepPercent: kind === "PREPAID_PICKUP" ? draft.expireKeepPercent : settings.keepPercent,
      autoConfirm: settings.autoConfirm,
      validUntil: kind === "PREPAID_PICKUP" ? iso(prepaidExpiry(now, draft.validDays)) : null,
    },
  };
}
