import "server-only";
import { z } from "zod";
import { socialSignIn } from "./auth-flow";
import { clientIpOf, ok, readJson, route } from "./http";
import { limit } from "./rate-limit";
import type { SocialProvider } from "./social-token";

const body = z.object({
  idToken: z.string().min(20).max(8000),
  intent: z.enum(["student", "business"]).default("student"),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  deviceName: z.string().max(200).optional(),
});

/** `POST /auth/google` va `/auth/apple` — bir xil: token tekshiruvi, kirish yoki ro'yxat tokeni. Chegara — kod tekshirish bilan bir xil. */
export function socialRoute(provider: SocialProvider) {
  return route(async (request) => {
    await limit("verify", clientIpOf(request));
    const input = await readJson(request, body);
    const result = await socialSignIn(provider, input.idToken, input.intent, input, {
      deviceName: input.deviceName,
      userAgent: request.headers.get("user-agent"),
    });
    return ok(result);
  });
}
