import { z } from "zod";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { businessInfoSchema, registerBusiness } from "@/server/api/register";

/**
 * Biznes ro'yxati (`/auth/password` → `registrationTicket`, intent `business`): egasi hisobi va ariza ochiladi,
 * tokenlar qaytadi. Keyin: `POST /business/documents` (guvohnoma, 1–3 foto, logotip) → `POST /business/submit`.
 */
export const POST = route(async (request) => {
  await limit("register", clientIpOf(request));
  const body = await readJson(request, businessInfoSchema.extend({ registrationTicket: z.string().max(2000), deviceName: z.string().max(200).optional() }));
  return ok(await registerBusiness(body.registrationTicket, body, { deviceName: body.deviceName, userAgent: request.headers.get("user-agent") }), 201);
});
