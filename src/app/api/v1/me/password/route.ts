import { z } from "zod";
import { cleanPassword, isValidPassword } from "@/lib/password";
import { passwordInput } from "@/server/api/auth-flow";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { authenticate, loadApiUser, meView, mustSetPassword } from "@/server/api/session";
import { attemptPassword, hashPassword, savePassword } from "@/server/auth/password";

/**
 * Parol o'rnatish yoki almashtirish (kirgan foydalanuvchi): `{ current?, password, confirm, deviceName? }`.
 * Parolsiz eski hisob yoki admin tiklagan (`mustSetPassword`) — joriy parolsiz; aks holda `current` majburiy (xatolar
 * kirishdagi qulf hisobida). Boshqa qurilmalardagi sessiyalar yopiladi, joriysi ochiq qoladi. → `{ user }`.
 */
export const POST = route(async (request) => {
  const { user, sessionId } = await authenticate(request);
  if (user.role === "ADMIN") throw new ApiError("admin_not_supported");
  await limit("password", user.id);
  const body = await readJson(
    request,
    z.object({ current: passwordInput.optional(), password: passwordInput, confirm: passwordInput, deviceName: z.string().max(200).optional() }),
  );
  if (!isValidPassword(body.password)) throw new ApiError("weak_password");
  if (cleanPassword(body.password) !== cleanPassword(body.confirm)) throw new ApiError("password_mismatch");

  if (!mustSetPassword(user)) {
    if (!body.current) throw new ApiError("password_required");
    const check = await attemptPassword(user, body.current);
    if (!check.ok) {
      throw check.reason === "wrong"
        ? new ApiError("wrong_current_password", { left: check.left })
        : new ApiError("password_locked", { retryInSeconds: check.retryInSeconds });
    }
  }
  await savePassword(
    user.id,
    hashPassword(body.password),
    user.passwordHash ? "change" : "set",
    { via: "api", deviceName: body.deviceName, userAgent: request.headers.get("user-agent") },
    { keepSessionId: sessionId, closeOthers: true },
  );
  return ok({ user: meView(await loadApiUser(user.id)) });
});
