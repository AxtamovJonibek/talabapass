import { z } from "zod";
import { verifyCode } from "@/server/api/auth-flow";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";

/** Ro'yxat: SMS kodni tekshirish → `setPassword` va qadam tokeni (`ticket`); paroli bor hisob — `account_exists`. */
export const POST = route(async (request) => {
  await limit("verify", clientIpOf(request));
  const body = await readJson(
    request,
    z.object({ phone: z.string().max(32), code: z.string().max(12), intent: z.enum(["student", "business"]).default("student") }),
  );
  return ok(await verifyCode(body.phone, body.code, body.intent));
});
