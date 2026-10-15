"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../auth/session";
import { unblockBusiness, unblockUser } from "../moderation";

const id = z.string().min(1).max(40);

/** "Bloklanganlar": talabani blokdan chiqarish. */
export async function unblockUserAction(raw: unknown): Promise<{ ok: boolean }> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ userId: id }).safeParse(raw);
  if (!input.success) return { ok: false };
  const ok = await unblockUser(input.data.userId, admin.id);
  revalidatePath("/admin/bloklanganlar");
  return { ok };
}

export async function unblockBusinessAction(raw: unknown): Promise<{ ok: boolean }> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id }).safeParse(raw);
  if (!input.success) return { ok: false };
  const ok = await unblockBusiness(input.data.businessId, admin.id);
  revalidatePath("/admin/bloklanganlar");
  return { ok };
}
