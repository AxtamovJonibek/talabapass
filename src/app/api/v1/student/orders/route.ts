import { ok, route } from "@/server/api/http";
import { requireApiStudent } from "@/server/api/session";
import { studentOrders } from "@/server/preorder/views";

/** "Mening buyurtmalarim" (saytdagi `/buyurtmalar`): oxirgi 50 ta buyurtma */
export const GET = route(async (request) => {
  const { user } = await requireApiStudent(request);
  return ok({ orders: await studentOrders(user.id) });
});
