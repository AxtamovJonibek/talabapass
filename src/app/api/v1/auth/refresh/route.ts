import { z } from "zod";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { rotateRefreshToken } from "@/server/api/session";

/** Token yangilash: refresh token aylanadi (eskisi yaroqsiz; qayta kelsa — sessiya yopiladi). */
export const POST = route(async (request) => {
  await limit("refresh", clientIpOf(request));
  const body = await readJson(request, z.object({ refreshToken: z.string().min(20).max(200) }));
  return ok({ tokens: await rotateRefreshToken(body.refreshToken) });
});
