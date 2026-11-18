import { z } from "zod";
import { ok, readQuery, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { businessStats } from "@/server/business/stats";
import { signedFileUrl } from "@/server/api/files";

/**
 * B6 ko'rsatkichlari (saytdagi `/biznes?davr=`): `period=1|7|30` (bugun, 7 va 30 kun, Toshkent kunlari). Sotuvlar soni
 * (+ oldingi davrga nisbatan), tushum, o'rtacha chek, berilgan chegirma, yangi mijozlar, qayta kelganlar ulushi,
 * grafik (bugun — soatlar, aks holda kunlar), voronka, issiqlik xaritasi, Excel hisobot havolasi, universitetlar, chegirmalar jadvali, oxirgi sotuvlar, kassirlar.
 */
export const GET = route(async (request) => {
  const { business } = await requireApiOwner(request);
  const { period } = readQuery(request, z.object({ period: z.enum(["1", "7", "30"]).default("7") }));
  const stats = await businessStats(business.id, Number(period) as 1 | 7 | 30);
  const { heat, sales, ...rest } = stats;
  return ok({
    business,
    ...rest,
    // Issiqlik xaritasi: soat ustunlari va bo'sh bo'lmagan kataklar [hafta kuni 0–6, soat, soni]
    heat: { hours: heat.hours, cells: [...heat.grid].map(([key, count]) => [...key.split(":").map(Number), count]), busiest: heat.busiest, quietest: heat.quietest },
    sales: sales.map((s) => ({ ...s, at: s.at.toISOString() })),
    // Excel hisobot (saytdagi `/api/biznes/hisobot`) — imzoli havola
    reportUrl: signedFileUrl("report", `${business.id}_${period}`),
  });
});
