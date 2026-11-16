import { ApiError, idParam, ok, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { removeCashier } from "@/server/business/cashiers";

/** Kassirni faolsizlantirish (`id` — a'zolik): a'zolik yopiladi, kassirning barcha sessiyalari darhol o'chadi. */
export const DELETE = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  if (!(await removeCashier(user.id, await idParam(ctx)))) throw new ApiError("not_found");
  return ok({ ok: true });
});
