import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { cashierRegisterSchema, registerCashier } from "@/server/api/register";

/** Kassir ro'yxati: `/auth/verify` (`role: "cashier"`) → `/auth/password` → `registrationTicket` + ism → kassir hisobi. */
export const POST = route(async (request) => {
  await limit("register", clientIpOf(request));
  const body = await readJson(request, cashierRegisterSchema);
  return ok(await registerCashier(body, { deviceName: body.deviceName, userAgent: request.headers.get("user-agent") }), 201);
});
