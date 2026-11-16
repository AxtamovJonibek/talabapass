"use server";

import { z } from "zod";
import type { DiscountField, DiscountProblem } from "@/lib/discount";
import { requireRole } from "../auth/session";
import { discountDraftSchema as draftSchema, saveDiscount, setDiscountActive } from "../business/discounts";

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
