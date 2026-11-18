import { discountBookingInput } from "@/lib/preorder";
import { ApiError, idParam, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { limit } from "@/server/api/rate-limit";
import { saveDiscountBooking } from "@/server/preorder/settings";

/** Chegirmaning band qilish rejimi va maydonlari (tekshiruvsiz). Audit `discount.booking` oldin → keyin. */
export const PUT = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const id = await idParam(ctx);
  const body = await readJson(request, discountBookingInput);
  const result = await saveDiscountBooking(user.id, id, body);
  if (!result.ok) throw new ApiError(result.error === "notFound" ? "not_found" : result.error === "noPrice" ? "preorder_no_price" : "invalid_request");
  return ok({ ok: true });
});
