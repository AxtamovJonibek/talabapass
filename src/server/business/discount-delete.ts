import "server-only";
import { audit } from "../audit";
import { db } from "../db";
import { storage } from "../storage";

export type DeleteDiscountResult = { ok: true; result: "deleted" | "ended" } | { ok: false; error: "notFound" };

/**
 * Egasi chegirmasini o'chiradi (faqat o'z biznesiniki). Tarixi yo'q (kupon, buyurtma, sotuv bo'lmagan) chegirma rasmlari bilan
 * butunlay o'chadi; tarixi bor chegirma hisobotlar buzilmasligi uchun `ENDED` qilinadi (talabaga ko'rinmaydi).
 */
export async function deleteOwnDiscount(ownerId: string, discountId: string): Promise<DeleteDiscountResult> {
  const discount = await db.discount.findFirst({
    where: { id: discountId, business: { ownerId } },
    select: { id: true, title: true, status: true, businessId: true, images: { select: { fileKey: true } }, _count: { select: { coupons: true, orders: true, redemptions: true } } },
  });
  if (!discount) return { ok: false, error: "notFound" };
  if (discount._count.coupons > 0 || discount._count.orders > 0 || discount._count.redemptions > 0) {
    await db.$transaction(async (tx) => {
      await tx.discount.update({ where: { id: discountId }, data: { status: "ENDED" } });
      await audit({ actorId: ownerId, action: "discount.end", entity: "Discount", entityId: discountId, meta: { from: discount.status, title: discount.title } }, tx);
    });
    return { ok: true, result: "ended" };
  }
  await db.$transaction(async (tx) => {
    await tx.discountImage.deleteMany({ where: { discountId } });
    await tx.discountDay.deleteMany({ where: { discountId } });
    await tx.discountView.deleteMany({ where: { discountId } });
    await tx.savedDiscount.deleteMany({ where: { discountId } });
    await tx.bookingSeat.deleteMany({ where: { discountId } });
    await tx.discount.delete({ where: { id: discountId } });
    await audit({ actorId: ownerId, action: "discount.delete", entity: "Discount", entityId: discountId, meta: { title: discount.title, businessId: discount.businessId, status: discount.status } }, tx);
  });
  await Promise.all(discount.images.map((i) => storage().delete(i.fileKey).catch(() => undefined)));
  return { ok: true, result: "deleted" };
}
