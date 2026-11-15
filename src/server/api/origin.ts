import "server-only";
import { z } from "zod";
import { isValidPoint, type Point } from "@/lib/geo";
import { regionById } from "@/lib/regions";
import { db } from "../db";
import { ApiError } from "./http";

/**
 * Masofa hisoblanadigan nuqta (saytdagi `tp_loc` cookie o'rniga so'rov parametri): `lat`+`lng` (GPS, ~100 m ga
 * yaxlitlanadi), `districtId` (tuman markazi) yoki `regionId` (viloyat markazi, `src/lib/regions.ts`). Yo'q — null.
 */
export const originQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  districtId: z.string().regex(/^[a-z0-9]{10,40}$/).optional(),
  regionId: z.string().max(40).optional(),
});

export async function resolveOrigin(q: z.infer<typeof originQuery>): Promise<Point | null> {
  if (q.lat !== undefined && q.lng !== undefined) {
    const point = { lat: Math.round(q.lat * 1000) / 1000, lng: Math.round(q.lng * 1000) / 1000 };
    if (!isValidPoint(point)) throw new ApiError("invalid_request", { fields: ["lat", "lng"] });
    return point;
  }
  if (q.districtId) {
    const district = await db.district.findUnique({ where: { id: q.districtId }, select: { lat: true, lng: true } });
    if (!district) throw new ApiError("invalid_request", { fields: ["districtId"] });
    return { lat: district.lat, lng: district.lng };
  }
  if (q.regionId) {
    const region = regionById(q.regionId);
    if (!region) throw new ApiError("invalid_request", { fields: ["regionId"] });
    return { lat: region.lat, lng: region.lng };
  }
  return null;
}
