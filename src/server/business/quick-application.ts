import "server-only";
import type { QuickApplication } from "@/lib/business-application";
import { audit } from "../audit";
import { accountData, accountPhone, type NewAccount } from "../auth/new-account";
import { db } from "../db";
import { isUniqueViolation } from "../db-errors";
import { districtFromAddress, ownBusiness } from "./registration";

/**
 * Ilovadagi qisqa ariza (`lib/business-application.ts`): kategoriya, ish vaqti va joylashuvni tasdiqlashda admin to'ldiradi,
 * shuning uchun hozircha standart kategoriya va bo'sh ish vaqti. Mas'ul shaxs nomi yo'q.
 */

const dataOf = (info: QuickApplication) => ({ name: info.name, address: info.address, tin: info.tin, publicPhone: info.phone, telegram: info.telegram });

/** Egasi arizani o'zgartira oladigan holatlar: hali yuborilmagan yoki rad etilgan. */
const editable = (b: { status: string; submittedAt: Date | null }) => (b.status === "PENDING" && b.submittedAt === null) || b.status === "REJECTED";

/** Egasi hisobi va ariza (hali yuborilmagan: rasm keyin yuklanadi, so'ng `submitQuickBusiness`). STIR band bo'lsa — xato. */
export async function createQuickBusiness(account: NewAccount, info: QuickApplication): Promise<{ ok: true; userId: string } | { ok: false; error: "tinTaken" }> {
  const districtId = await districtFromAddress(info.address);
  try {
    const user = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { ...accountData(account), role: "BUSINESS_OWNER" }, select: { id: true } });
      await tx.business.create({
        data: { ...dataOf(info), kind: "SHOP", workingHours: "", ownerId: user.id, districtId, contactPhone: accountPhone(account), members: { create: { userId: user.id, role: "OWNER" } } },
      });
      return user;
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    if (isUniqueViolation(error, "tin")) return { ok: false, error: "tinTaken" };
    throw error;
  }
}

/** Yuborilmagan yoki rad etilgan arizani tuzatish. */
export async function updateQuickBusiness(ownerId: string, info: QuickApplication): Promise<{ ok: true } | { ok: false; error: "notEditable" | "tinTaken" }> {
  const business = await ownBusiness(ownerId);
  if (!business || !editable(business)) return { ok: false, error: "notEditable" };
  try {
    await db.business.update({ where: { id: business.id }, data: { ...dataOf(info), districtId: await districtFromAddress(info.address) } });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error, "tin")) return { ok: false, error: "tinTaken" };
    throw error;
  }
}

/** Arizani tekshiruvga yuborish (hujjat va rozilik so'ralmaydi). */
export async function submitQuickBusiness(ownerId: string): Promise<{ ok: true } | { ok: false; error: "notEditable" }> {
  const business = await ownBusiness(ownerId);
  if (!business || !editable(business)) return { ok: false, error: "notEditable" };
  return db.$transaction(async (tx) => {
    const updated = await tx.business.updateMany({ where: { id: business.id, status: business.status }, data: { status: "PENDING", submittedAt: new Date(), rejectReason: null } });
    if (updated.count === 0) return { ok: false as const, error: "notEditable" as const };
    await audit({ actorId: ownerId, action: "business.submit", entity: "Business", entityId: business.id, meta: { source: "app" } }, tx);
    return { ok: true as const };
  });
}
