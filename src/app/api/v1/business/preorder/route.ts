import { preorderSettingsInput } from "@/lib/preorder";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { limit } from "@/server/api/rate-limit";
import { ownerPreorder, savePreorderSettings } from "@/server/preorder/settings";

/** Sozlamalar → "Oldindan band qilish" (saytdagi `/biznes/sozlamalar`): umumiy qoidalar, bugun to'xtatilganmi, chegirmalar va rejimlari. */
export const GET = route(async (request) => {
  const { user } = await requireApiOwner(request);
  const data = await ownerPreorder(user.id);
  if (!data) throw new ApiError("business_not_ready");
  return ok(data);
});

/** Umumiy qoidalarni saqlash (yoqish, ish jadvali, tayyorlash vaqti, to'lov, bekor qilish, tasdiqlash). Audit `preorder.settings`. */
export const PUT = route(async (request) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const body = await readJson(request, preorderSettingsInput);
  const result = await savePreorderSettings(user.id, body);
  if (!result.ok)
    throw new ApiError(
      result.error === "noSchedule" ? "preorder_no_schedule" : result.error === "noBusiness" ? "business_not_ready" : result.error === "noPermission" ? "permission_denied" : "invalid_request",
    );
  return ok({ ok: true });
});
