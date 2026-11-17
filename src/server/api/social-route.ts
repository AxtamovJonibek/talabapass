import "server-only";
import { z } from "zod";
import { authSecret } from "../env";
import { openAppleTicket } from "./apple-web";
import { socialSignIn } from "./auth-flow";
import { ApiError, clientIpOf, ok, readJson, route } from "./http";
import { limit } from "./rate-limit";
import type { SocialProvider } from "./social-token";

const body = z.object({
  idToken: z.string().min(20).max(8000).optional(),
  /** Apple web oqimi (Android): callback bergan muhrlangan ticket va ilovadagi verifier (`apple-web.ts`) */
  ticket: z.string().max(12000).optional(),
  verifier: z.string().max(128).optional(),
  intent: z.enum(["student", "business"]).default("student"),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  deviceName: z.string().max(200).optional(),
});

/**
 * `POST /auth/google` va `/auth/apple` — bir xil: token tekshiruvi, kirish yoki ro'yxat tokeni. Chegara — kod tekshirish bilan bir xil.
 * Apple'da token o'rniga `{ ticket, verifier }` ham bo'lishi mumkin (Android web oqimi): ticket ochilmasa — `social_invalid`.
 */
export function socialRoute(provider: SocialProvider) {
  return route(async (request) => {
    await limit("verify", clientIpOf(request));
    const input = await readJson(request, body);
    let idToken = input.idToken;
    let names = { firstName: input.firstName, lastName: input.lastName };
    if (provider === "APPLE" && input.ticket) {
      const opened = openAppleTicket(input.ticket, input.verifier ?? "", authSecret());
      if (!opened) throw new ApiError("social_invalid");
      idToken = opened.idToken;
      names = { firstName: opened.firstName ?? names.firstName, lastName: opened.lastName ?? names.lastName };
    }
    if (!idToken) throw new ApiError("invalid_request", { fields: ["idToken"] });
    const result = await socialSignIn(provider, idToken, input.intent, names, {
      deviceName: input.deviceName,
      userAgent: request.headers.get("user-agent"),
    });
    return ok(result);
  });
}
