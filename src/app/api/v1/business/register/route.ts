import { z } from "zod";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { quickApplicationSchema, registerBusiness } from "@/server/api/register";

/**
 * Biznes ro'yxati (`/auth/password` → `registrationTicket`, intent `business`): egasi hisobi va ariza ochiladi (nom, manzil,
 * STIR, telefon, Telegram), tokenlar qaytadi. Keyin ixtiyoriy `POST /business/documents?kind=logo` → `POST /business/submit`.
 */
export const POST = route(async (request) => {
  await limit("register", clientIpOf(request));
  const body = await readJson(request, quickApplicationSchema.extend({ registrationTicket: z.string().max(2000), deviceName: z.string().max(200).optional() }));
  return ok(await registerBusiness(body.registrationTicket, body, { deviceName: body.deviceName, userAgent: request.headers.get("user-agent") }), 201);
});
