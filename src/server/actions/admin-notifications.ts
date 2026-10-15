"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AUDIENCES } from "@/lib/notifications";
import { audit } from "../audit";
import { requireRole } from "../auth/session";
import { db } from "../db";
import { audienceReach } from "../notifications/audience";
import { createNotification, dispatchNotification, type CreateResult } from "../notifications/send";

/** A3 — bildirishnoma yuborish/rejalashtirish. "Hozir" bo'lsa javobdan keyin (`after`) yuboriladi. */
export async function sendNotificationAction(raw: unknown): Promise<CreateResult> {
  const admin = await requireRole("ADMIN");
  const result = await createNotification(raw, admin.id);
  if (result.ok) {
    if (result.immediate) after(() => dispatchNotification(result.id));
    revalidatePath("/admin/bildirishnomalar");
  }
  return result;
}

/** Qamrov: tanlangan auditoriyada nechta foydalanuvchi bor (formada jonli ko'rsatiladi). */
export async function audienceReachAction(raw: unknown): Promise<number | null> {
  await requireRole("ADMIN");
  const input = z.object({ audience: z.enum(AUDIENCES), ids: z.array(z.string().min(1).max(40)).max(100) }).safeParse(raw);
  if (!input.success) return null;
  return audienceReach(input.data.audience, input.data.ids);
}

/** Hali yuborilmagan (SCHEDULED) xabarni bekor qiladi. Yuborilgan yoki yuborilayotganini o'chirib bo'lmaydi. */
export async function cancelNotificationAction(raw: unknown): Promise<{ ok: boolean }> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ id: z.string().min(1).max(40) }).safeParse(raw);
  if (!input.success) return { ok: false };
  const removed = await db.notification.deleteMany({ where: { id: input.data.id, status: "SCHEDULED", audience: { not: "USER" } } });
  if (removed.count === 0) return { ok: false };
  await audit({ actorId: admin.id, action: "notification.cancel", entity: "Notification", entityId: input.data.id });
  revalidatePath("/admin/bildirishnomalar");
  return { ok: true };
}
