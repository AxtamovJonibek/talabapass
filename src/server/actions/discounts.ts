"use server";

import { z } from "zod";
import type { DiscountField, DiscountProblem } from "@/lib/discount";
import { requireRole } from "../auth/session";
import { saveDiscount, setDiscountActive } from "../business/discounts";

const intNull = z.number().int().min(-1_000_000_000).max(1_000_000_000).nullable();
const draftSchema = z.object({
  title: z.string().max(200),
  type: z.enum(["PERCENT", "FIXED_PRICE", "BOGO"]),
  originalPrice: intNull,
  percent: intNull,
  newPrice: intNull,
  weekdays: z.array(z.number().int()).max(7),
  fromMinute: intNull,
  toMinute: intNull,
  dailyLimit: intNull,
  perStudentLimit: z.enum(["DAILY", "WEEKLY", "UNLIMITED"]),
  startsOn: z.string().max(10),
  endsOn: z.string().max(10),
  terms: z.string().max(400),
});

export type SaveDiscountActionResult =
  | { ok: true; id: string }
  | { ok: false; error: "noBusiness" | "notFound" | "notEditable" }
  | { ok: false; errors: Partial<Record<DiscountField, DiscountProblem>> };

/** B2 / WB2 — "Qoralama" yoki "E'lon qilish". Muvaffaqiyatda id qaytadi: klient rasmlarni yuklab, ro'yxatga o'tadi. */
export async function saveDiscountAction(discountId: string | null, raw: unknown, intent: "draft" | "publish"): Promise<SaveDiscountActionResult> {
  const user = await requireRole("BUSINESS_OWNER");
  const draft = draftSchema.safeParse(raw);
  if (!draft.success) return { ok: false, errors: { title: "title" } };
  const id = discountId === null ? null : z.string().max(40).parse(discountId);
  const result = await saveDiscount(user.id, id, draft.data, intent === "publish" ? "publish" : "draft");
  if (!result.ok) return result;
  return { ok: true, id: result.id };
}

/** B5 — chegirma yonidagi switch: faolni to'xtatish / to'xtatilganni yoqish. */
export async function setDiscountActiveAction(discountId: string, active: boolean): Promise<{ ok: boolean }> {
  const user = await requireRole("BUSINESS_OWNER");
  return { ok: await setDiscountActive(user.id, z.string().max(40).parse(discountId), active === true) };
}
