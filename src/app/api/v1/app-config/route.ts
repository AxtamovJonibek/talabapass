import { appConfigFromEnv } from "@/lib/app-version";
import { ok, route } from "@/server/api/http";

/**
 * Ilova sozlamasi (tokensiz, ilova har ochilganda): `minVersion` dan past versiya — majburiy yangilash ekrani,
 * `latestVersion` — ixtiyoriy, `storeUrls` — do'kon havolalari. Qiymatlar env'dan (`src/lib/app-version.ts`).
 */
export const GET = route(async () => ok(appConfigFromEnv(process.env)));
