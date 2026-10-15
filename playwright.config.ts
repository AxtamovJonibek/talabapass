import "dotenv/config";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
/** Jonli havolada yugurish: E2E_BASE_URL berilsa dev server ko'tarilmaydi (`npm run test:e2e:live`). */
const live = process.env.E2E_BASE_URL?.replace(/\/$/, "");

/**
 * E2E testlar lokal baza (seed bilan) va OTP_FIXED_CODE=000000 ga tayanadi — .env.example ga qarang.
 * Ishlab turgan dev server bo'lsa o'shani ishlatadi, bo'lmasa o'zi ko'taradi.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // Dev server sahifani birinchi ochishda kompilyatsiya qiladi — standart 5 soniya yetmasligi mumkin.
  expect: { timeout: 15_000 },
  // Standart — telefon o'lchami (T-ekranlar); veb ko'rinish testlari o'zi kengaytiradi.
  use: { viewport: { width: 390, height: 844 }, baseURL: live ?? `http://localhost:${port}`, locale: "uz-UZ", timezoneId: "Asia/Tashkent" },
  webServer: live
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
