import { REGIONS } from "@/lib/regions";
import { ok, route } from "@/server/api/http";
import { db } from "@/server/db";

/**
 * Joy tanlovi (saytdagi `location-select` bilan bir xil guruhlar): Toshkent tumanlari (bazadan, markaz koordinatasi bilan)
 * va viloyatlar (`src/lib/regions.ts`). Kirishsiz — maxfiy ma'lumot yo'q. Tanlangani `/deals?districtId=` yoki `?regionId=`.
 */
export const GET = route(async () => {
  const districts = await db.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, lat: true, lng: true } });
  return ok({ districts, regions: REGIONS });
});
