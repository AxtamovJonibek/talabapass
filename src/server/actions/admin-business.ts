"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localizedPath } from "@/i18n/routing";
import { addCashierByAdmin, blockCashierAsAdmin, createDiscountByAdmin, duplicateDiscountByAdmin, removeCashierAsAdmin, voidSale } from "../admin/business-ops";
import { requireRole } from "../auth/session";
import type { SuperActionResult } from "./admin-super";

/* Admin biznes kartasi amallari: har birida avval `requireRole("ADMIN")`; audit va egasi jurnali — server funksiyalarida. */

const id = z.string().min(1).max(40);

function refresh() {
  for (const path of ["/admin/bizneslar", "/admin/hamkorlar", "/admin/jurnal"]) revalidatePath(localizedPath(path));
}

type Result = { ok: boolean; error?: string; fields?: string[]; id?: string; errors?: Record<string, string> };
const out = (r: Result): SuperActionResult => (r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error, fields: r.fields, problems: r.errors });

export async function createDiscountForBusinessAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id, draft: z.unknown() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await createDiscountByAdmin(admin.id, input.data.businessId, input.data.draft);
  refresh();
  return out(r);
}

export async function duplicateDiscountAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ discountId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await duplicateDiscountByAdmin(admin.id, input.data.discountId);
  refresh();
  return out(r);
}

export async function addCashierAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const r = await addCashierByAdmin(admin.id, raw);
  refresh();
  return out(r);
}

export async function removeCashierAdminAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id, memberId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await removeCashierAsAdmin(admin.id, input.data.businessId, input.data.memberId);
  refresh();
  return out(r);
}

export async function blockCashierAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id, userId: id, blocked: z.boolean(), reason: z.string().trim().max(200).default("") }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await blockCashierAsAdmin(admin.id, input.data.businessId, input.data.userId, input.data.blocked, input.data.reason);
  refresh();
  revalidatePath(localizedPath("/admin/bloklanganlar"));
  return out(r);
}

export async function voidSaleAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const r = await voidSale(admin.id, raw);
  refresh();
  return out(r);
}
