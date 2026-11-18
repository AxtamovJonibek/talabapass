import { z } from "zod";
import { verifyForgot } from "@/server/api/auth-flow";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";

/** Tiklash kodi: `{ identifier, code }` → `{ next: "setPassword", ticket }` (keyin `POST /auth/password`). */
export const POST = route(async (request) => {
  await limit("verify", clientIpOf(request));
  const body = await readJson(request, z.object({ identifier: z.string().max(270), code: z.string().max(12) }));
  return ok(await verifyForgot(body.identifier, body.code));
});
