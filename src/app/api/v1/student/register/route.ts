import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { registerStudent, studentRegisterSchema } from "@/server/api/register";

/** Talaba ro'yxati (`/auth/password` → `registrationTicket`). Hisob DRAFT holatda ochiladi — keyin guvohnoma. */
export const POST = route(async (request) => {
  await limit("register", clientIpOf(request));
  const body = await readJson(request, studentRegisterSchema);
  return ok(await registerStudent(body, { deviceName: body.deviceName, userAgent: request.headers.get("user-agent") }), 201);
});
