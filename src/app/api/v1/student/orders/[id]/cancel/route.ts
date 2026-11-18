import { ApiError, idParam, ok, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { requireApiStudent } from "@/server/api/session";
import { cancelOrderByStudent } from "@/server/preorder/views";

/** Talaba buyurtmani bekor qiladi (saytdagi `cancelOrderAction` bilan bir xil o'tish va pul qoidasi) */
export const POST = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiStudent(request);
  await limit("write", user.id);
  const result = await cancelOrderByStudent(user.id, await idParam(ctx));
  if (!result.ok) throw new ApiError("order_closed");
  return ok({ ok: true });
});
