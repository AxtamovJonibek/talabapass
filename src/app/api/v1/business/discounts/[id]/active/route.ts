import { z } from "zod";
import { ApiError, idParam, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { limit } from "@/server/api/rate-limit";
import { setDiscountActive } from "@/server/business/discounts";

/** Faol chegirmani to'xtatish / to'xtatilganni yoqish (tekshiruvsiz). Boshqa holatda — `not_editable`, faollar chegarasi — `active_limit`. */
export const POST = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const id = await idParam(ctx);
  const { active } = await readJson(request, z.object({ active: z.boolean() }));
  const result = await setDiscountActive(user.id, id, active);
  if (!result.ok) throw new ApiError(result.error === "activeLimit" ? "active_limit" : "not_editable");
  return ok({ ok: true, status: active ? "ACTIVE" : "PAUSED" });
});
