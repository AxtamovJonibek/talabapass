import { z } from "zod";
import { ORDER_FILTERS, type OrderFilter } from "@/lib/preorder";
import { ok, readQuery, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { db } from "@/server/db";
import { businessOrders } from "@/server/preorder/views";

/**
 * Buyurtmalar paneli (saytdagi `/biznes/buyurtmalar`): `filter=new|preparing|ready|done`. Ilova ochiq paytda bir necha
 * soniyada so'raydi — `newIds` (javob kutayotganlar) ichida yangi id paydo bo'lsa tovush. `enabled` — oldindan buyurtma
 * yoqilganmi (o'chiq bo'lsa ham eski buyurtmalar ko'rinadi). `confirmBy` — shu vaqtgacha javob berilmasa avtomatik bekor.
 */
export const GET = route(async (request) => {
  const { business } = await requireApiOwner(request);
  const { filter } = readQuery(request, z.object({ filter: z.enum(Object.keys(ORDER_FILTERS) as [OrderFilter, ...OrderFilter[]]).default("new") }));
  const [orders, settings] = await Promise.all([
    businessOrders(business.id, filter),
    db.preorderSettings.findUnique({ where: { businessId: business.id }, select: { enabled: true } }),
  ]);
  return ok({ enabled: settings?.enabled ?? false, ...orders });
});
