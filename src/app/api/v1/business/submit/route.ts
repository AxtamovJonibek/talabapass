import { ApiError, ok, route } from "@/server/api/http";
import { requireApiRole } from "@/server/api/session";
import { submitQuickBusiness } from "@/server/business/quick-application";

/** Arizani tekshiruvga yuborish (hujjat va rozilik so'ralmaydi). */
export const POST = route(async (request) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  const result = await submitQuickBusiness(user.id);
  if (!result.ok) throw new ApiError("not_editable");
  return ok({ ok: true, status: "PENDING" });
});
