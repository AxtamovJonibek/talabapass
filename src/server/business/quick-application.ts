import "server-only";
import type { QuickApplication } from "@/lib/business-application";
import { audit } from "../audit";
import type { NewAccount } from "../auth/new-account";
import { db } from "../db";
import { createApplication, ownBusiness, updateApplication } from "./registration";

/**
 * Ilovadagi qisqa ariza (`lib/business-application.ts`): kategoriya, ish vaqti va joylashuvni tasdiqlashda admin to'ldiradi,
 * shuning uchun hozircha standart kategoriya va bo'sh ish vaqti. Mas'ul shaxs nomi yo'q.
 */

const dataOf = (info: QuickApplication) => ({ name: info.name, address: info.address, tin: info.tin, publicPhone: info.phone, telegram: info.telegram });

/** Egasi arizani o'zgartira oladigan holatlar: hali yuborilmagan yoki rad etilgan. */
const editable = (b: { status: string; submittedAt: Date | null }) => (b.status === "PENDING" && b.submittedAt === null) || b.status === "REJECTED";

/** Egasi hisobi va ariza (hali yuborilmagan: rasm keyin yuklanadi, so'ng `submitQuickBusiness`). STIR band bo'lsa — xato. */
export const createQuickBusiness = (account: NewAccount, info: QuickApplication) => createApplication(account, { ...dataOf(info), kind: "SHOP", workingHours: "" });

/** Yuborilmagan yoki rad etilgan arizani tuzatish. */
export const updateQuickBusiness = (ownerId: string, info: QuickApplication) => updateApplication(ownerId, dataOf(info));

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
