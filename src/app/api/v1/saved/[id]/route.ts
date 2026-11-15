import { ApiError, idParam, ok, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { requireApiStudent } from "@/server/api/session";
import { db } from "@/server/db";
import { visibleDiscountWhere } from "@/server/student/feed";

/** Saqlash (idempotent): faqat talabaga ko'rinadigan chegirma. */
export const PUT = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiStudent(request);
  await limit("write", user.id);
  const id = await idParam(ctx);
  if (!(await db.discount.count({ where: { AND: [{ id }, visibleDiscountWhere(new Date())] } }))) throw new ApiError("not_found");
  await db.savedDiscount.upsert({ where: { studentId_discountId: { studentId: user.id, discountId: id } }, create: { studentId: user.id, discountId: id }, update: {} });
  return ok({ saved: true });
});

/** Saqlanganlardan olib tashlash (idempotent). */
export const DELETE = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiStudent(request);
  await db.savedDiscount.deleteMany({ where: { studentId: user.id, discountId: await idParam(ctx) } });
  return ok({ saved: false });
});
