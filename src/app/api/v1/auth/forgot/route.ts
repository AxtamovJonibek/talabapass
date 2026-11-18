import { z } from "zod";
import { requestForgot } from "@/server/api/auth-flow";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";

/**
 * "Parolni unutdim": `{ identifier }` (telefon yoki email) → `{ channel: "sms" | "email", resendInSeconds }`. Javob hisob
 * borligidan qat'i nazar bir xil; kod faqat hisob bo'lsa yuboriladi (SMS — 5 daqiqa, email — 10 daqiqa, 5 urinish).
 */
export const POST = route(async (request) => {
  await limit("forgot", clientIpOf(request));
  const body = await readJson(request, z.object({ identifier: z.string().max(270) }));
  return ok(await requestForgot(body.identifier, clientIpOf(request)));
});
