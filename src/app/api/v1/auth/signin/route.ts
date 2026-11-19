import { z } from "zod";
import { passwordInput, signInWithPassword } from "@/server/api/auth-flow";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";

/** Telefon yoki email + parol bilan kirish (SMSsiz). 5 ta ketma-ket xato — 15 daqiqa qulf. */
export const POST = route(async (request) => {
  await limit("login", clientIpOf(request));
  const body = await readJson(request, z.object({ identifier: z.string().min(1).max(200), password: passwordInput, deviceName: z.string().max(200).optional() }));
  return ok(await signInWithPassword(body.identifier, body.password, { deviceName: body.deviceName, userAgent: request.headers.get("user-agent") }));
});
