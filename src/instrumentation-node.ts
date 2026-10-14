import { assertProductionEnv } from "@/server/env-check";

/**
 * Faqat Node muhitida (instrumentation.ts dinamik import qiladi — `process.exit` Edge'da yo'q).
 *
 * Shunchaki xato tashlash yetarli emas: Next uni log'ga yozib, port ochiq holda har so'rovga 500 qaytaraveradi.
 * Hosting "ishlamoqda" deb ko'rsatmasligi uchun jarayonning o'zi tugatiladi.
 */
export function checkEnvOrExit(): void {
  try {
    assertProductionEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    // Test muhitida jarayonni o'ldirmaymiz — xatoning o'zi tekshiriladi.
    if (process.env.VITEST) throw error;
    process.exit(1);
  }
}
