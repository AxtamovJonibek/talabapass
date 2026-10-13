import "dotenv/config";
import { expect, type Page } from "@playwright/test";
import pg from "pg";

/** Testlar uchun to'g'ridan-to'g'ri baza ulanishi (seed foydalanuvchilarini topish, holatni tayyorlash). */
export async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export const FIXED_CODE = process.env.OTP_FIXED_CODE ?? "000000";

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
  await withDb((db) => db.query(`DELETE FROM "OtpCode" WHERE phone = $1`, [phone]));
}

/** +998XXXXXXXXX → formaga yoziladigan 9 raqam */
export const local = (phone: string) => phone.replace(/^\+998/, "");

export async function requestCode(page: Page, phone: string, role: "Talaba" | "Biznes" = "Talaba") {
  await clearOtp(phone);
  // Tugma React ulanmasdan bosilsa forma oddiy GET bilan yuboriladi — avval sahifa tinchishini kutamiz.
  await page.goto("/kirish", { waitUntil: "networkidle" });
  if (role === "Biznes") await page.getByRole("tab", { name: "Biznes" }).click();
  await page.locator("#login-phone").fill(local(phone));
  await page.getByRole("button", { name: "SMS kod olish" }).click();
  await expect(page.getByLabel("1-raqam")).toBeEnabled();
}

export async function enterCode(page: Page, code: string) {
  await page.getByLabel("1-raqam").click();
  await page.keyboard.type(code);
}

export async function signIn(page: Page, phone: string) {
  await requestCode(page, phone);
  await enterCode(page, FIXED_CODE);
}
