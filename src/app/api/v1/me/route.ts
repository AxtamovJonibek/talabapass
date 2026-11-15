import { z } from "zod";
import { passwordInput } from "@/server/api/auth-flow";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { authenticate, meView } from "@/server/api/session";
import { deleteOwnAccount } from "@/server/account";
import { attemptPassword } from "@/server/auth/password";

/** Joriy foydalanuvchi (rol, talaba holati, biznesi). */
export const GET = route(async (request) => {
  const { user } = await authenticate(request);
  return ok({ user: meView(user) });
});

/**
 * Hisobni o'chirish (App Store / Google Play talabi). Parol bilan tasdiqlanadi (xatolar kirishdagi bilan bir hisobda —
 * 5 ta xato qulflaydi). Faol buyurtma bo'lsa — `open_orders`.
 */
export const DELETE = route(async (request) => {
  const { user } = await authenticate(request);
  await limit("password", user.id);
  const body = await readJson(request, z.object({ password: passwordInput }));
  const check = await attemptPassword(user, body.password);
  if (!check.ok) {
    throw check.reason === "wrong"
      ? new ApiError("wrong_password", { left: check.left })
      : new ApiError("password_locked", { retryInSeconds: check.retryInSeconds });
  }
  const result = await deleteOwnAccount(user.id);
  if (!result.ok) throw new ApiError(result.problem === "open_orders" ? "open_orders" : "forbidden");
  return ok({ ok: true });
});
