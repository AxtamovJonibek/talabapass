import "dotenv/config";
import { expect, type Page } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";

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
    // Testlar bitta IP'dan keladi — soatiga 10 ta so'rov chegarasi ham tozalanadi.
    // Sayt oqimi ilova bilan bir xil API chegaralarini ishlatadi (`api:verify|login|password|register`, bitta IP'dan)
    await db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'otp-ip:%' OR key LIKE 'api:%'`);
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
 * Telefon qadamini ochadi ("Parolni unutdim" yoki "Telefon raqam bilan"). Sahifa hali ulanmagan paytdagi bosish hisobga
 * olinmaydi (dev serverda tez-tez) — maydon chiqquncha qayta bosiladi.
 */
export async function toPhoneStep(page: Page, button: "Parolni unutdim" | "Telefon raqam bilan") {
  const trigger = page.getByRole("button", { name: button });
  await expect(async () => {
    if (await trigger.isVisible()) await trigger.click({ timeout: 3_000 });
    await expect(page.locator("#login-phone")).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 40_000 });
}

/**
 * SMS kod so'rash: kirish sahifasi → "Parolni unutdim" → raqam → kod qadami. Seed hisoblarida parol yo'q, shuning uchun
 * testlar parolni shu yo'l bilan o'rnatadi (`signIn`); yangi raqam uchun — `webRegister`.
 */
export async function requestCode(page: Page, phone: string, role: "Talaba" | "Biznes" = "Talaba") {
  await clearOtp(phone);
  // Tugma React ulanmasdan bosilsa forma oddiy GET bilan yuboriladi — avval sahifa tinchishini kutamiz.
  await page.goto(role === "Biznes" ? "/uz/kirish?rol=biznes" : "/uz/kirish", { waitUntil: "networkidle" });
  await toPhoneStep(page, "Parolni unutdim");
  await page.locator("#login-phone").fill(local(phone));
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await expect(codeBox(page)).toBeEnabled();
}

export async function enterCode(page: Page, code: string) {
  await codeBox(page).click();
  await page.keyboard.type(code);
}

/** .env.development dagi ADMIN_PASSWORD_HASH ning paroli (faqat lokal). */
export const ADMIN_PASSWORD = "dev-admin-parol";

export async function enterAdminPassword(page: Page, password: string = ADMIN_PASSWORD) {
  await page.locator("#admin-password").fill(password);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
}

/** Testlarning umumiy paroli (seed hisoblarida parol yo'q: `signIn` uni tiklash yo'li bilan o'rnatadi). */
export const TEST_PASSWORD = "Sinov2026";

/** Parol qadamidagi ikkala maydon + "Davom etish" (o'rnatish va tiklash). */
export async function fillNewPassword(page: Page, password: string = TEST_PASSWORD) {
  await page.locator("#auth-password").fill(password);
  await page.locator("#auth-repeat").fill(password);
  await page.getByRole("button", { name: "Davom etish" }).click();
}

/**
 * Kirish. Admin uchun SMS koddan keyin parol ham kiritiladi (`adminPassword: false` — kiritilmaydi). Boshqa rollar —
 * kod → yangi parol (tiklash oqimi, boshqa sessiyalar yopiladi; testlar ketma-ket yuradi).
 */
export async function signIn(page: Page, phone: string, { adminPassword = true } = {}) {
  await requestCode(page, phone);
  await enterCode(page, FIXED_CODE);
  await Promise.race([page.locator("#auth-password").waitFor(), page.waitForURL((url) => url.pathname === "/uz/kirish/admin")]);
  if (await page.locator("#auth-password").isVisible()) await fillNewPassword(page);
  await page.waitForURL((url) => url.pathname !== "/uz/kirish");
  if (adminPassword && new URL(page.url()).pathname === "/uz/kirish/admin") await enterAdminPassword(page);
}

/** Yangi raqam: ro'yxat usuli → telefon → kod → parol; ma'lumotlar qadami ochiladi (`path`: talaba yoki biznes ro'yxati). */
export async function reachRegistrationDetails(page: Page, phone: string, path: "/uz/talaba/royxat" | "/uz/biznes/royxat" = "/uz/talaba/royxat") {
  await clearOtp(phone);
  await page.goto(path, { waitUntil: "networkidle" });
  await toPhoneStep(page, "Telefon raqam bilan");
  await page.locator("#login-phone").fill(local(phone));
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await expect(codeBox(page)).toBeEnabled();
  await enterCode(page, FIXED_CODE);
  await page.locator("#auth-password").waitFor();
  await fillNewPassword(page);
}

/** Yangi talaba: ma'lumotlar (universitet qidiruvi "tatu", 3-kurs). Oxirida guvohnoma sahifasi. */
export async function webRegisterStudent(page: Page, phone: string, { firstName = "Sinov", lastName = "Talabayev" } = {}) {
  await reachRegistrationDetails(page, phone);
  await page.locator("#reg-first").fill(firstName);
  await page.locator("#reg-last").fill(lastName);
  await page.locator("#reg-uni").fill("tatu");
  await page.getByRole("option", { name: /^Toshkent axborot texnologiyalari universiteti/ }).first().click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
}

/** Haqiqiy (o'qiladigan) kichik JPEG — yuklash testlari uchun. Tozalash soxta baytlarni rad etadi. */
export const sampleJpeg = async (): Promise<Buffer> =>
  sharp({ create: { width: 120, height: 80, channels: 3, background: "#e4e2db" } }).jpeg().toBuffer();
