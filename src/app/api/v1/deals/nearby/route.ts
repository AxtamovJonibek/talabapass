import { z } from "zod";
import { ApiError, ok, readQuery, route } from "@/server/api/http";
import { originQuery, resolveOrigin } from "@/server/api/origin";
import { requireApiStudent } from "@/server/api/session";
import { feedDeals } from "@/server/student/feed";
import { signUrls } from "@/server/api/files";

/** Yaqin joylar (xarita): joy majburiy; radius ichidagi, koordinatasi bor chegirmalar — yaqini oldin. */
export const GET = route(async (request) => {
  await requireApiStudent(request);
  const q = readQuery(request, originQuery.extend({ radiusKm: z.coerce.number().min(0.1).max(50).default(5), limit: z.coerce.number().int().min(1).max(200).default(50) }));
  const origin = await resolveOrigin(q);
  if (!origin) throw new ApiError("invalid_request", { fields: ["lat", "lng"] });
  const deals = (await feedDeals(new Date(), origin))
    .filter((d) => d.distanceKm !== null && d.distanceKm <= q.radiusKm)
    .sort((a, b) => a.distanceKm! - b.distanceKm!)
    .slice(0, q.limit);
  return ok(signUrls({ origin, deals }));
});
