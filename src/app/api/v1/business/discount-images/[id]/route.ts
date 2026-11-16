import { ApiError, idParam, ok, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { removeDiscountImage } from "@/server/business/discount-images";

/** Chegirma rasmini o'chirish (faqat o'z chegirmasidan; tasdiqlanganida — qayta tekshiruv). */
export const DELETE = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  if (!(await removeDiscountImage(user.id, await idParam(ctx)))) throw new ApiError("not_found");
  return ok({ ok: true });
});
