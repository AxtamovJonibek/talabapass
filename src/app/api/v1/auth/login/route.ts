import { z } from "zod";
import { loginWithIdentifier, passwordInput } from "@/server/api/auth-flow";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";

/**
 * Kirish: `{ identifier, password }` — telefon raqam yoki email + parol, SMSsiz. Xato — bitta umumiy `invalid_credentials`
 * (hisob borligi bilinmaydi). 5 ta ketma-ket xato — 15 daqiqa qulf (`password_locked`).
 */
export const POST = route(async (request) => {
  await limit("login", clientIpOf(request));
  const body = await readJson(request, z.object({ identifier: z.string().max(270), password: passwordInput, deviceName: z.string().max(200).optional() }));
  return ok(await loginWithIdentifier(body.identifier, body.password, { deviceName: body.deviceName, userAgent: request.headers.get("user-agent") }));
});
