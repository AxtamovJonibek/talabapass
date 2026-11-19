import { ApiError, idParam, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { saveDiscountInput, savedOrThrow } from "@/server/api/discounts";
import { signUrls } from "@/server/api/files";
import { limit } from "@/server/api/rate-limit";
import { discountImages } from "@/server/business/discount-images";
import { deleteOwnDiscount } from "@/server/business/discount-delete";
import { ownDiscount, saveDiscount } from "@/server/business/discounts";

/** Tahrirlash formasi: `{ id, status, rejectReason, category, draft, images: [{ id, url }] }` (faqat o'z biznesiniki). */
export const GET = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  const discount = await ownDiscount(user.id, await idParam(ctx));
  if (!discount) throw new ApiError("not_found");
  return ok(signUrls({ ...discount, images: await discountImages(discount.id) }));
});

/**
 * Tahrirlash. Tasdiqlangan (faol/to'xtatilgan) chegirmada mazmun (nom, tur, narx/foiz, shartlar) o'zgarsa — qayta
 * `PENDING_REVIEW`; kun/soat/son/muddat — holati saqlanadi. Tugagan chegirma — `not_editable`.
 */
export const PATCH = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const id = await idParam(ctx);
  const { draft, intent } = await readJson(request, saveDiscountInput);
  return ok(savedOrThrow(await saveDiscount(user.id, id, draft, intent)));
});

/** O'chirish: tarixi yo'q chegirma butunlay o'chadi (`result: "deleted"`), tarixi borini `ENDED` qilib tugatadi (`result: "ended"`). */
export const DELETE = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const result = await deleteOwnDiscount(user.id, await idParam(ctx));
  if (!result.ok) throw new ApiError("not_found");
  return ok({ ok: true, result: result.result });
});
