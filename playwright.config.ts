import "dotenv/config";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);

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
  use: { baseURL: `http://localhost:${port}`, locale: "uz-UZ", timezoneId: "Asia/Tashkent" },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
