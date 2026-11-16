import { socialRoute } from "@/server/api/social-route";

/**
 * Apple bilan kirish (ilova, iOS): `{ idToken, intent, firstName?, lastName? }` — ismni Apple faqat birinchi ruxsatda
 * ilovaga beradi, tokenda yo'q. `APPLE_CLIENT_ID` sozlanmagan bo'lsa — 503 `social_unavailable`.
 */
export const POST = socialRoute("APPLE");
