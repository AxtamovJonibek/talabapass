import { socialRoute } from "@/server/api/social-route";

/** Google bilan kirish (ilova): `{ idToken, intent }` → `signedIn` yoki `register` (SMS va parolsiz ro'yxat). */
export const POST = socialRoute("GOOGLE");
