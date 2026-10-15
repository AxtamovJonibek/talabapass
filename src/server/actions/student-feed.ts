"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { authCookieOptions } from "../auth/cookie-options";
import { requireActiveStudent } from "../auth/student";
import { db } from "../db";
import { visibleDiscountWhere } from "../student/feed";
import { LOCATION_COOKIE, LOCATION_MAX_AGE_MS } from "../student/location";

const locationSchema = z.union([
  z.object({ districtId: z.string().regex(/^[a-z0-9]{10,40}$/) }),
  z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
]);

/** Masofa hisoblanadigan joy: tuman yoki brauzer geolokatsiyasi (~100 m gacha yaxlitlanadi). */
export async function setLocationAction(input: unknown): Promise<{ ok: boolean }> {
  await requireActiveStudent();
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const value = parsed.data;
  let cookie: string;
  if ("districtId" in value) {
    if (!(await db.district.findUnique({ where: { id: value.districtId }, select: { id: true } }))) return { ok: false };
    cookie = `d:${value.districtId}`;
  } else {
    cookie = `g:${value.lat.toFixed(3)},${value.lng.toFixed(3)}`;
  }
  (await cookies()).set(LOCATION_COOKIE, cookie, authCookieOptions(LOCATION_MAX_AGE_MS));
  return { ok: true };
}

/** T5 "Saqlash": faqat talabaga ko'rinadigan chegirmani. Natija — yangi holat. */
export async function toggleSavedAction(discountId: unknown): Promise<{ saved: boolean }> {
  const user = await requireActiveStudent();
  const id = z.string().max(40).parse(discountId);
  const key = { studentId_discountId: { studentId: user.id, discountId: id } };
  if (await db.savedDiscount.findUnique({ where: key })) {
    await db.savedDiscount.delete({ where: key });
    return { saved: false };
  }
  const visible = await db.discount.count({ where: { AND: [{ id }, visibleDiscountWhere(new Date())] } });
  if (!visible) return { saved: false };
  await db.savedDiscount.create({ data: { studentId: user.id, discountId: id } }).catch(() => undefined);
  return { saved: true };
}
