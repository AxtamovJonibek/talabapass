import "server-only";
import { db } from "./db";

/**
 * Bloklash amallari. Bloklash va sessiyalarni yopish bitta tranzaksiyada: bloklangan foydalanuvchi
 * (yoki bloklangan biznes xodimlari) ochiq qolgan sessiya bilan ishlashda davom eta olmaydi.
 * Chaqiruvchi (admin action) avval `requireRole("ADMIN")` qiladi.
 */

export async function blockUser(userId: string, reason: string, actorId: string): Promise<void> {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status: "BLOCKED", blockedReason: reason } }),
    db.session.deleteMany({ where: { userId } }),
    db.studentProfile.updateMany({ where: { userId }, data: { status: "BLOCKED" } }),
    db.auditLog.create({ data: { actorId, action: "user.block", entity: "User", entityId: userId, meta: { reason } } }),
  ]);
}

/**
 * Biznesni bloklaydi: faol chegirmalari talabalarga ko'rinmay qoladi (lenta faqat APPROVED biznesni oladi),
 * egasi va barcha kassirlarining sessiyalari yopiladi.
 */
export async function blockBusiness(businessId: string, reason: string, actorId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const business = await tx.business.update({
      where: { id: businessId },
      data: { status: "BLOCKED", rejectReason: reason, reviewedById: actorId, reviewedAt: new Date() },
      select: { ownerId: true, members: { select: { userId: true } } },
    });
    const staff = [...new Set([business.ownerId, ...business.members.map((m) => m.userId)])];
    await tx.session.deleteMany({ where: { userId: { in: staff } } });
    await tx.auditLog.create({ data: { actorId, action: "business.block", entity: "Business", entityId: businessId, meta: { reason, staff: staff.length } } });
  });
}

/**
 * Talabani blokdan chiqaradi (A "Bloklanganlar"). Sessiyalar qaytmaydi — qaytadan SMS bilan kiradi.
 * Profil holati bloklashdan oldingisiga yaqin tiklanadi: guvohnoma muddati o'tmagan → APPROVED, o'tgan → EXPIRED,
 * guvohnomasi hech qachon tasdiqlanmagan → REJECTED (yangi guvohnoma yuklaydi).
 */
export async function unblockUser(userId: string, actorId: string, now = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const released = await tx.user.updateMany({ where: { id: userId, status: "BLOCKED" }, data: { status: "ACTIVE", blockedReason: null } });
    if (released.count === 0) return false;
    const profile = await tx.studentProfile.findUnique({ where: { userId }, select: { cardNumber: true, cardExpiresAt: true } });
    if (profile) {
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const status = !profile.cardNumber || !profile.cardExpiresAt ? "REJECTED" : profile.cardExpiresAt >= today ? "APPROVED" : "EXPIRED";
      await tx.studentProfile.update({ where: { userId }, data: { status } });
    }
    await tx.auditLog.create({ data: { actorId, action: "user.unblock", entity: "User", entityId: userId } });
    return true;
  });
}

/**
 * Biznesni blokdan chiqaradi: ilgari admin tasdiqlagan bo'lsa → APPROVED, aks holda tekshiruv navbatiga (PENDING) qaytadi —
 * hech qachon ko'rilmagan biznes bloklashdan chiqarish bilan "tasdiqlanib" qolmaydi.
 */
export async function unblockBusiness(businessId: string, actorId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const business = await tx.business.findUnique({ where: { id: businessId }, select: { status: true } });
    if (!business || business.status !== "BLOCKED") return false;
    const approvedBefore = (await tx.auditLog.count({ where: { entity: "Business", entityId: businessId, action: "business.approve" } })) > 0;
    const released = await tx.business.updateMany({
      where: { id: businessId, status: "BLOCKED" },
      data: { status: approvedBefore ? "APPROVED" : "PENDING", rejectReason: null, reviewedById: actorId, reviewedAt: new Date() },
    });
    if (released.count === 0) return false;
    await tx.auditLog.create({ data: { actorId, action: "business.unblock", entity: "Business", entityId: businessId, meta: { restored: approvedBefore ? "APPROVED" : "PENDING" } } });
    return true;
  });
}
