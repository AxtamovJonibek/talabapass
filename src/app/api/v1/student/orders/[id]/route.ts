import { ApiError, idParam, ok, route } from "@/server/api/http";
import { requireApiStudent } from "@/server/api/session";
import { studentOrder } from "@/server/preorder/views";

/** Buyurtma (saytdagi `/buyurtmalar/<id>`): holat, vaqt chizig'i, QR siri (tasdiqlangan/tayyor bo'lsa), bekor qilish summasi */
export const GET = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiStudent(request);
  const order = await studentOrder(user.id, await idParam(ctx));
  if (!order) throw new ApiError("not_found");
  return ok({ order });
});
