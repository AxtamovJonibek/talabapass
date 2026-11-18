import { ApiError, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { bookingPreview, previewInput } from "@/server/preorder/preview";

/** Jonli preview: saqlanmagan qoidalar va rejim bilan talabaga ko'rinadigan kunlar/slotlar, oynalar, summa, qoidalar, `offHours`. */
export const POST = route(async (request) => {
  const { user } = await requireApiOwner(request);
  const body = await readJson(request, previewInput);
  const preview = await bookingPreview(user.id, body);
  if (!preview) throw new ApiError("not_found");
  return ok(preview);
});
