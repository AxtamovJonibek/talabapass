import { appReturnUrl, parseAppleUser, sealAppleTicket, STATE_RE } from "@/server/api/apple-web";
import { route } from "@/server/api/http";
import { authSecret } from "@/server/env";

const FORM_LIMIT = 32 * 1024;
const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};

/**
 * Apple `form_post` javobi (`redirect_uri`): `id_token`, `state`, birinchi ruxsatda `user` (ism). Token shu yerda
 * tekshirilmaydi — muhrlangan `ticket` ga joylanib ilovaga qaytariladi, ilova uni verifier bilan `POST /auth/apple` ga
 * yuboradi (`src/server/api/apple-web.ts`). Bekor qilingan yoki xato — `error=cancelled|failed`.
 */
export const POST = route(async (request) => {
  const userAgent = request.headers.get("user-agent");
  const back = (params: Record<string, string>) => new Response(null, { status: 303, headers: { location: appReturnUrl(params, userAgent), "cache-control": "no-store" } });

  if (Number(request.headers.get("content-length") ?? 0) > FORM_LIMIT) return back({ error: "failed" });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back({ error: "failed" });
  }
  const error = text(form, "error");
  if (error) return back({ error: error === "user_cancelled_authorize" ? "cancelled" : "failed" });
  const state = text(form, "state");
  const idToken = text(form, "id_token");
  if (!STATE_RE.test(state) || idToken.length < 20 || idToken.length > 8000) return back({ error: "failed" });
  return back({ ticket: sealAppleTicket(state, { idToken, ...parseAppleUser(text(form, "user")) }, authSecret()) });
});
