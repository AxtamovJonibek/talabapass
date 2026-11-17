import { vi } from "vitest";

// Baza testlari route handler'larni Next so'rovisiz to'g'ridan-to'g'ri chaqiradi: `connection()` (`api/http.ts` `route()`, cron)
// so'rov doirasidan tashqarida xato tashlaydi — testda u faqat "dinamik" belgisi, shuning uchun bo'sh (vitest.db.config.mts).
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => undefined }));
