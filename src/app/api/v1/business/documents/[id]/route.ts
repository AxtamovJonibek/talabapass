import { ApiError, idParam, ok, route } from "@/server/api/http";
import { requireApiRole } from "@/server/api/session";
import { removeBusinessDoc } from "@/server/business/registration";

/** Yuborilmagan/rad etilgan arizadan faylni olib tashlash (faqat o'z biznesidan). */
export const DELETE = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  if (!(await removeBusinessDoc(user.id, await idParam(ctx)))) throw new ApiError("not_found");
  return ok({ ok: true });
});
