import { ApiError, idParam, ok, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { revokeInvite } from "@/server/business/cashiers";

/** Ochiq taklifni bekor qilish (faqat o'z biznesiniki). */
export const DELETE = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  if (!(await revokeInvite(user.id, await idParam(ctx)))) throw new ApiError("not_found");
  return ok({ ok: true });
});
