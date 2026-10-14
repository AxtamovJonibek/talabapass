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
