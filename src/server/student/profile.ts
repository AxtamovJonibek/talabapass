import "server-only";
import type { ProfileInput } from "@/lib/profile";
import { db } from "../db";

export type ProfileResult = { ok: true } | { ok: false; field: "districtId" };

/** Ism, kurs, fakultet va tumanni yangilaydi (bitta tranzaksiya). Tuman — mavjud tumanlardan biri yoki bo'sh. */
export async function updateProfile(userId: string, input: ProfileInput): Promise<ProfileResult> {
  if (input.districtId && !(await db.district.findUnique({ where: { id: input.districtId }, select: { id: true } }))) {
    return { ok: false, field: "districtId" };
  }
  await db.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      student: { update: { course: input.course, faculty: input.faculty, districtId: input.districtId } },
    },
  });
  return { ok: true };
}

export async function setNotifyDeals(userId: string, on: boolean): Promise<void> {
  await db.studentProfile.update({ where: { userId }, data: { notifyDeals: on } });
}

/** Profil sahifasi uchun jami: tejalgan summa, xaridlar soni, nechta joyda. */
export async function studentTotals(studentId: string): Promise<{ totalSaved: number; totalCount: number; places: number }> {
  const [total, places] = await Promise.all([
    db.redemption.aggregate({ where: { studentId }, _sum: { discountAmount: true }, _count: true }),
    db.redemption.groupBy({ by: ["businessId"], where: { studentId } }),
  ]);
  return { totalSaved: total._sum.discountAmount ?? 0, totalCount: total._count, places: places.length };
}

export const districtOptions = () => db.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
