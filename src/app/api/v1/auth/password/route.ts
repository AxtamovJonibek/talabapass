import { z } from "zod";
import { passwordInput, setPassword } from "@/server/api/auth-flow";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";

/**
 * Parol o'rnatish (`ticket` — `/auth/verify`, `/auth/google|apple` yoki `/auth/forgot/verify` dan): yangi raqam yoki
 * Google/Apple (→ `registrationTicket`), parolsiz eski hisob yoki "Parolni unutdim" (boshqa sessiyalar yopiladi).
 */
export const POST = route(async (request) => {
  await limit("password", clientIpOf(request));
  const body = await readJson(
    request,
    z.object({ ticket: z.string().max(2000), password: passwordInput, confirm: passwordInput, deviceName: z.string().max(200).optional() }),
  );
  const result = await setPassword(body.ticket, body.password, body.confirm, { deviceName: body.deviceName, userAgent: request.headers.get("user-agent") });
  return ok(result);
});
