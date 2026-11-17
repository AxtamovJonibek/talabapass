import { z } from "zod";
import { openAppleTicket } from "@/server/api/apple-web";
import { confirmOwnIdentity, passwordInput } from "@/server/api/auth-flow";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { authenticate, meView } from "@/server/api/session";
import { deleteOwnAccount } from "@/server/account";
import { attemptPassword } from "@/server/auth/password";
import { authSecret } from "@/server/env";

/** Joriy foydalanuvchi (rol, talaba holati, biznesi). */
export const GET = route(async (request) => {
  const { user } = await authenticate(request);
  return ok({ user: meView(user) });
});

/**
 * Hisobni o'chirish (App Store / Google Play talabi). Parol bilan tasdiqlanadi (xatolar kirishdagi bilan bir hisobda —
 * 5 ta xato qulflaydi); parolsiz (Google/Apple bilan ochilgan) hisob — shu provayderdan yangi ID token bilan
 * (Android'da Apple — web oqimining `ticket` + `verifier`i, `apple-web.ts`).
 * Faol buyurtma bo'lsa — `open_orders`.
 */
export const DELETE = route(async (request) => {
  const { user } = await authenticate(request);
  await limit("password", user.id);
  const body = await readJson(
    request,
    z.object({
      password: passwordInput.optional(),
      provider: z.enum(["GOOGLE", "APPLE"]).optional(),
      idToken: z.string().max(8000).optional(),
      ticket: z.string().max(12000).optional(),
      verifier: z.string().max(128).optional(),
    }),
  );
  let idToken = body.idToken;
  if (!idToken && body.provider === "APPLE" && body.ticket) {
    idToken = openAppleTicket(body.ticket, body.verifier ?? "", authSecret())?.idToken;
    if (!idToken && !user.passwordHash) throw new ApiError("social_invalid");
  }
  if (user.passwordHash || !body.provider || !idToken) {
    if (!body.password) throw new ApiError("password_required");
    const check = await attemptPassword(user, body.password);
    if (!check.ok) {
      throw check.reason === "wrong"
        ? new ApiError("wrong_password", { left: check.left })
        : new ApiError("password_locked", { retryInSeconds: check.retryInSeconds });
    }
  } else {
    await confirmOwnIdentity(user.id, body.provider, idToken);
  }
  const result = await deleteOwnAccount(user.id);
  if (!result.ok) throw new ApiError(result.problem === "open_orders" ? "open_orders" : "forbidden");
  return ok({ ok: true });
});
