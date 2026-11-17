import { appleWebClientId } from "@/lib/app-version";
import { appleAuthorizeUrl, appReturnUrl, STATE_RE } from "@/server/api/apple-web";
import { route } from "@/server/api/http";

/**
 * Apple web oqimining boshlanishi (Android ilovasi brauzerda ochadi): `?state=` (ilovadagi verifier'ning sha256 i) bilan
 * Apple'ning kirish sahifasiga. `APPLE_CLIENT_ID` da Services ID yo'q yoki state yaroqsiz — ilovaga `error` bilan qaytadi.
 */
export const GET = route(async (request) => {
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const clientId = appleWebClientId(process.env);
  const userAgent = request.headers.get("user-agent");
  const location = !clientId
    ? appReturnUrl({ error: "unavailable" }, userAgent)
    : !STATE_RE.test(state)
      ? appReturnUrl({ error: "failed" }, userAgent)
      : appleAuthorizeUrl(clientId, state);
  return new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });
});
