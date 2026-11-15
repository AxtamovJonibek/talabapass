import { ApiError, idParam, ok, route } from "@/server/api/http";
import { requireApiStudent } from "@/server/api/session";
import { cancelCoupon, studentCoupon } from "@/server/coupons/coupons";
import { db } from "@/server/db";

/**
 * Kupon holati (ekran internet bo'lsa bir necha soniyada so'raydi): `ACTIVE` (+ `coupon`), `REDEEMED`
 * (+ `redemptionId` — kassir tasdiqladi) yoki `CLOSED` (bekor/eskirgan).
 */
export const GET = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiStudent(request);
  const id = await idParam(ctx);
  const row = await db.coupon.findFirst({ where: { id, studentId: user.id }, select: { status: true, redemption: { select: { id: true } } } });
  if (!row) throw new ApiError("not_found");
  if (row.status === "REDEEMED") return ok({ status: "REDEEMED", redemptionId: row.redemption?.id ?? null });
  const coupon = row.status === "ACTIVE" ? await studentCoupon(user.id, id) : null;
  return ok(coupon ? { status: "ACTIVE", coupon } : { status: "CLOSED" });
});

/** Kuponni bekor qilish — kunlik qoldiq qaytadi (faqat faol kupon, bir marta). */
export const DELETE = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiStudent(request);
  if (!(await cancelCoupon(user.id, await idParam(ctx)))) throw new ApiError("not_found");
  return ok({ ok: true });
});
