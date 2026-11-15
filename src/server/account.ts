import "server-only";
import type { OrderStatus } from "@/generated/prisma/client";
import { audit } from "./audit";
import { closeCoupon } from "./coupons/coupons";
import { db } from "./db";
import { storage } from "./storage";

/** Pul hali hal bo'lmagan buyurtma holatlari — bunday buyurtma bor ekan hisob o'chirilmaydi. */
const OPEN_ORDERS: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "CONFIRMED", "READY"];

export type DeleteProblem = "open_orders" | "not_allowed";

/**
 * Foydalanuvchi o'z hisobini o'chiradi (App Store / Google Play talabi). Qator o'chirilmaydi: kupon, sotuv va buyurtma
 * tarixi biznes hisobotlarida qoladi. Shaxsiy ma'lumot tozalanadi va raqam bo'shatiladi (`deleted:<id>` — kirib
 * bo'lmaydi, shu raqam bilan keyin yangi hisob ochish mumkin), holat `DELETED`, barcha sessiyalar yopiladi.
 * - talaba: guvohnoma fayllari va profil rasmi o'chiriladi, guvohnoma № bo'shatiladi, faol kuponlar bekor (qoldiq qaytadi);
 * - biznes egasi: chegirmalar talabaga ko'rinmay qoladi (egasi faol emas), kassirlar a'zoligi yopiladi va ular chiqariladi;
 * - kassir: a'zoligi yopiladi.
 * Admin bu yo'l bilan o'chirilmaydi.
 */
export async function deleteOwnAccount(userId: string): Promise<{ ok: true } | { ok: false; problem: DeleteProblem }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      student: { select: { avatarKey: true, verifications: { select: { fileKey: true } } } },
      ownedBusinesses: { select: { id: true } },
    },
  });
  if (!user || user.role === "ADMIN") return { ok: false, problem: "not_allowed" };
  const businessIds = user.ownedBusinesses.map((b) => b.id);

  const openOrders = await db.order.count({
    where: { status: { in: OPEN_ORDERS }, OR: [{ studentId: userId }, ...(businessIds.length ? [{ businessId: { in: businessIds } }] : [])] },
  });
  if (openOrders > 0) return { ok: false, problem: "open_orders" };

  const activeCoupons = await db.coupon.findMany({ where: { studentId: userId, status: "ACTIVE" }, select: { id: true } });
  const files = [...(user.student?.verifications.map((v) => v.fileKey) ?? []), ...(user.student?.avatarKey ? [user.student.avatarKey] : [])];

  await db.$transaction(async (tx) => {
    for (const coupon of activeCoupons) await closeCoupon(tx, coupon.id, "CANCELLED");

    if (user.student) {
      await tx.verification.deleteMany({ where: { studentId: userId } });
      await tx.studentProfile.update({
        where: { userId },
        data: { cardNumber: null, faculty: null, avatarKey: null, districtId: null, notifyDeals: false },
      });
    }
    if (businessIds.length > 0) {
      const cashiers = await tx.businessMember.findMany({ where: { businessId: { in: businessIds }, role: "CASHIER", active: true }, select: { userId: true } });
      await tx.businessMember.updateMany({ where: { businessId: { in: businessIds } }, data: { active: false } });
      await tx.session.deleteMany({ where: { userId: { in: cashiers.map((c) => c.userId) } } });
      await tx.business.updateMany({ where: { id: { in: businessIds } }, data: { contactName: null, contactPhone: null } });
    }
    await tx.businessMember.updateMany({ where: { userId }, data: { active: false } });

    await tx.savedDiscount.deleteMany({ where: { studentId: userId } });
    await tx.userNotification.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.pushDevice.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        phone: `deleted:${userId}`,
        firstName: null,
        lastName: null,
        blockedReason: null,
        telegramChatId: null,
        passwordHash: null,
        passwordFails: 0,
        passwordLockedUntil: null,
      },
    });
    await audit({ actorId: userId, action: "user.delete", entity: "User", entityId: userId, meta: { role: user.role } }, tx);
  });

  // Fayllar tranzaksiya muvaffaqiyatli tugagandan keyingina o'chiriladi
  await Promise.all(files.map((key) => storage().delete(key).catch(() => undefined)));
  return { ok: true };
}
