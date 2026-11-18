import "dotenv/config";
import { expect, type Page } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";
import { hashAdminPassword } from "../src/server/auth/admin-password";

/**
 * Testlar uchun to'g'ridan-to'g'ri baza ulanishi (seed foydalanuvchilarini topish, holatni tayyorlash).
 * Lokal `prisma dev` (PGlite) dev server bilan bir vaqtda kelgan ulanishni ba'zan uzib yuboradi
 * (ECONNRESET / "Connection terminated"), ayniqsa test tugashi bilan ~10 soniya — shunda 20 soniyagacha qayta uriniladi.
 */
export async function withDb<T>(run: (client: pg.Client) => Promise<T>, attempt = 1): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  client.on("error", () => undefined);
  try {
    await client.connect();
    return await run(client);
  } catch (error) {
    const message = (error as Error).message ?? "";
    if (attempt < 20 && /ECONNRESET|Connection terminated/.test(message)) {
      await new Promise((r) => setTimeout(r, 1000));
      return withDb(run, attempt + 1);
    }
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** .env.development dagi OTP_FIXED_CODE bilan bir xil bo'lishi kerak. */
export const FIXED_CODE = "000000";

export type SeedPhones = { admin: string; student: string; owner: string; cashier: string };

/** Seed'dagi har bir roldan bittadan foydalanuvchi raqami. */
export async function seedPhones(): Promise<SeedPhones> {
  return withDb(async (db) => {
    const one = async (sql: string) => {
      const { rows } = await db.query<{ phone: string }>(sql);
      if (!rows[0]) throw new Error("Seed ma'lumot topilmadi — `npm run db:seed` ishga tushirilganmi?");
      return rows[0].phone;
    };
    return {
      admin: await one(`SELECT phone FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" LIMIT 1`),
      student: await one(`SELECT phone FROM "User" WHERE phone = '+998904123785'`),
      owner: await one(`SELECT u.phone FROM "User" u JOIN "Business" b ON b."ownerId" = u.id WHERE b.name = 'Bodom Choyxonasi'`),
      cashier: await one(`SELECT phone FROM "User" WHERE role = 'CASHIER' ORDER BY "createdAt" LIMIT 1`),
    };
  });
}

/** SMS chegaralari (60 soniyada 1 ta, soatiga 5 ta) testlarga xalaqit bermasligi uchun raqamning kodlarini tozalaydi. */
export async function clearOtp(phone: string): Promise<void> {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "OtpCode" WHERE phone = $1`, [phone]);
    await db.query(`DELETE FROM "EmailCode"`);
    // Testlar bitta IP'dan keladi — soatiga 10 ta so'rov chegarasi ham tozalanadi.
    await db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'otp-ip:%'`);
  });
}

/** +998XXXXXXXXX → formaga yoziladigan 9 raqam */
export const local = (phone: string) => phone.replace(/^\+998/, "");

/**
 * SMS kodning birinchi katagi. Ro'yxat sahifasida ikki ko'rinish (telefon va veb) DOM'da turadi,
 * shuning uchun faqat ko'rinib turgani olinadi.
 */
export const codeBox = (page: Page) => page.getByLabel("1-raqam").locator("visible=true");

/**
 * Ro'yxat, 1-qadam: `/kirish?royxat=…` da raqamga SMS kod so'rash (kod kataklari chiqquncha).
 * Kirish SMSsiz — kod faqat ro'yxat, "Parolni unutdim" va admin kirishi uchun.
 */
export async function requestCode(page: Page, phone: string, role: "Talaba" | "Biznes" = "Talaba") {
  await clearOtp(phone);
  // Tugma React ulanmasdan bosilsa forma oddiy GET bilan yuboriladi — avval sahifa tinchishini kutamiz.
  await page.goto(`/uz/kirish?royxat=${role === "Biznes" ? "biznes" : "talaba"}`, { waitUntil: "networkidle" });
  await page.locator("#register-phone").fill(local(phone));
  await page.getByRole("button", { name: "SMS kod olish" }).click();
  await expect(codeBox(page)).toBeEnabled();
}

export async function enterCode(page: Page, code: string) {
  await codeBox(page).click();
  await page.keyboard.type(code);
}

/** Barcha seed foydalanuvchilari (admin'dan boshqa) paroli — prisma/seed.ts dagi SEED_PASSWORD. */
export const TEST_PASSWORD = "Talaba2026";
const TEST_HASH = hashAdminPassword(TEST_PASSWORD);

/** Yangi parol maydonlarini to'ldiradi (ro'yxat, tiklash, majburiy parol). */
export async function fillNewPassword(page: Page, password: string = TEST_PASSWORD, prefix = "set") {
  await page.locator(`#${prefix}-password`).fill(password);
  await page.locator(`#${prefix}-confirm`).fill(password);
}

/**
 * Ro'yxat: telefon → SMS kod → parol → ma'lumotlar formasi (`/talaba/royxat` yoki `/biznes/royxat`).
 * Raqam tasdiqlangan va parol o'rnatilgan holda formaga o'tadi (formada kod so'ralmaydi).
 */
export async function registerPhone(page: Page, phone: string, role: "Talaba" | "Biznes" = "Talaba", password: string = TEST_PASSWORD) {
  await requestCode(page, phone, role);
  await enterCode(page, FIXED_CODE);
  await expect(page.locator("#set-password")).toBeVisible();
  await fillNewPassword(page, password);
  await page.getByRole("button", { name: "Davom etish" }).click();
  await page.waitForURL(role === "Biznes" ? "**/uz/biznes/royxat" : "**/uz/talaba/royxat");
}

/** Testlar bir IP'dan ko'p kiradi: kirish chegarasi (IP bo'yicha) va xato urinishlar hisobini tozalaydi. */
export async function clearLoginLimits(): Promise<void> {
  await withDb((db) => db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'api:login:%' OR key LIKE 'api:forgot:%' OR key LIKE 'login-ghost:%'`));
}

/**
 * Hisobga TEST_PASSWORD qo'yiladi (testda bazaga parolsiz yozilgan yoki boshqa test parolini almashtirgan bo'lsa ham),
 * qulf va "keyingi kirishda almashtirish" belgisi tushiriladi. Admin'ga tegmaydi (uning kirishi alohida).
 */
export async function ensurePassword(phone: string): Promise<void> {
  await withDb((db) =>
    db.query(
      `UPDATE "User" SET "passwordHash" = $2, "passwordSetAt" = COALESCE("passwordSetAt", now()),
         "passwordFails" = 0, "passwordLockedUntil" = NULL, "passwordResetRequired" = false
       WHERE phone = $1 AND role <> 'ADMIN'`,
      [phone, TEST_HASH],
    ),
  );
}

/** .env.development dagi ADMIN_PASSWORD_HASH ning paroli (faqat lokal). */
export const ADMIN_PASSWORD = "dev-admin-parol";

export async function enterAdminPassword(page: Page, password: string = ADMIN_PASSWORD) {
  await page.locator("#admin-password").fill(password);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
}

/** Admin: `/kirish/admin` — SMS kod, keyin (`adminPassword`) umumiy admin paroli. */
export async function signInAdmin(page: Page, phone: string, { adminPassword = true } = {}) {
  await clearOtp(phone);
  await page.goto("/uz/kirish/admin", { waitUntil: "networkidle" });
  await page.locator("#admin-phone").fill(local(phone));
  await page.getByRole("button", { name: "SMS kod olish" }).click();
  await enterCode(page, FIXED_CODE);
  await page.locator("#admin-password").waitFor();
  if (adminPassword) await enterAdminPassword(page);
}

/** Kirish: raqam + parol (SMSsiz). Admin raqami bo'lsa — admin yo'li (SMS kod + admin paroli). */
export async function signIn(page: Page, phone: string, { adminPassword = true, password = TEST_PASSWORD } = {}) {
  const { rows } = await withDb((db) => db.query<{ role: string }>(`SELECT role FROM "User" WHERE phone = $1`, [phone]));
  if (rows[0]?.role === "ADMIN") return signInAdmin(page, phone, { adminPassword });
  await ensurePassword(phone);
  await clearLoginLimits();
  await page.goto("/uz/kirish", { waitUntil: "networkidle" });
  await page.locator("#login-identifier").fill(local(phone));
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/uz/kirish");
}

/** Haqiqiy (o'qiladigan) kichik JPEG — yuklash testlari uchun. Tozalash soxta baytlarni rad etadi. */
export const sampleJpeg = async (): Promise<Buffer> =>
  sharp({ create: { width: 120, height: 80, channels: 3, background: "#e4e2db" } }).jpeg().toBuffer();
