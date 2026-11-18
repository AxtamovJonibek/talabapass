import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { limit } from "@/server/api/rate-limit";
import { setPreorderPaused } from "@/server/preorder/settings";

/** "Bugun qabul qilmayman" — darhol (Toshkent kuni). Audit `preorder.pause|resume`. */
export const POST = route(async (request) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const { paused } = await readJson(request, z.object({ paused: z.boolean() }));
  if (!(await setPreorderPaused(user.id, paused))) throw new ApiError("business_not_ready");
  return ok({ ok: true, paused });
});
