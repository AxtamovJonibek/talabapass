import { z } from "zod";
import { ok, readQuery, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { businessStats } from "@/server/business/stats";

/**
 * B6 ko'rsatkichlari (saytdagi `/biznes?davr=`): `period=1|7|30` (bugun, 7 va 30 kun, Toshkent kunlari). Sotuvlar soni
 * (+ oldingi davrga nisbatan), tushum, o'rtacha chek, berilgan chegirma, yangi mijozlar, qayta kelganlar ulushi,
 * grafik (bugun — soatlar, aks holda kunlar), voronka, universitetlar, chegirmalar jadvali, oxirgi sotuvlar, kassirlar.
 */
export const GET = route(async (request) => {
  const { business } = await requireApiOwner(request);
  const { period } = readQuery(request, z.object({ period: z.enum(["1", "7", "30"]).default("7") }));
  const stats = await businessStats(business.id, Number(period) as 1 | 7 | 30);
  const { heat, sales, ...rest } = stats;
  return ok({
    business,
    ...rest,
    // Issiqlik xaritasi — faqat xulosa (eng gavjum oyna va eng bo'sh kun)
    heat: { busiest: heat.busiest, quietest: heat.quietest },
    sales: sales.map((s) => ({ ...s, at: s.at.toISOString() })),
  });
});
