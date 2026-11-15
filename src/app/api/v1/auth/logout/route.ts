import { ok, route } from "@/server/api/http";
import { authenticate, closeApiSession } from "@/server/api/session";

/** Chiqish: joriy sessiya (va unga bog'langan push qurilmasi) o'chadi. Muddati o'tgan access token ham qabul qilinadi. */
export const POST = route(async (request) => {
  const { sessionId } = await authenticate(request, { allowExpired: true });
  await closeApiSession(sessionId);
  return ok({ ok: true });
});
