/**
 * Jonli (sinov serveri) havolada e2e: `npm run test:e2e:live -- [playwright argumentlari]`.
 * Kirish uchun `.env.staging` dagi baza (OTP cheklovlarini tozalash, seed foydalanuvchilarini topish) va OTP_FIXED_CODE kerak;
 * test faqat GET qiladi. Manzil: E2E_BASE_URL yoki https://talabapass.vercel.app. Admin sahifalari uchun E2E_ADMIN_PASSWORD
 * (bo'lmasa admin testi o'tkazib yuboriladi).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".env.staging")) {
  console.error(".env.staging topilmadi");
  process.exit(2);
}
process.loadEnvFile(".env.staging");
process.env.E2E_BASE_URL ??= "https://talabapass.vercel.app";
const args = process.argv.slice(2);
const result = spawnSync("npx", ["playwright", "test", ...(args.length ? args : ["navigation"])], { stdio: "inherit", shell: true, env: process.env });
process.exit(result.status ?? 1);
