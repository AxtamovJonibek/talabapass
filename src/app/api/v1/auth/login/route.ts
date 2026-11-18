import { z } from "zod";
import { loginWithPassword, passwordInput } from "@/server/api/auth-flow";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";

/** Parol bilan kirish (`verify` → `next: "password"`). 5 ta ketma-ket xato — 15 daqiqa qulf. */
export const POST = route(async (request) => {
  await limit("login", clientIpOf(request));
  const body = await readJson(request, z.object({ ticket: z.string().max(2000), password: passwordInput, deviceName: z.string().max(200).optional() }));
  const signedIn = await loginWithPassword(body.ticket, body.password, { deviceName: body.deviceName, userAgent: request.headers.get("user-agent") });
  return ok(signedIn);
});
