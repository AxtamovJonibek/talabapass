import { expect, test, type Page } from "@playwright/test";
import { reachRegistrationDetails, sampleJpeg, withDb } from "./helpers";

// Biznes ro'yxati (sayt): telefon → kod → parol → ma'lumotlar (nom, manzil, STIR, telefon, Telegram, rasm) → "Arizangiz qabul qilindi".
// To'liq oqim — e2e/web-auth.spec.ts; bu yerda xatolar va rasm yuklanmaganda.
const OWNER = "+998935550912";
const TIN = "309100912";

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "Business" WHERE tin = $1 OR "ownerId" IN (SELECT id FROM "User" WHERE phone = $2)`, [TIN, OWNER]);
    await db.query(`DELETE FROM "User" WHERE phone = $1`, [OWNER]);
    await db.query(`DELETE FROM "OtpCode" WHERE phone = $1`, [OWNER]);
    await db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'otp-ip:%'`);
  });
}
test.beforeEach(cleanup);
test.afterAll(cleanup);

const business = () =>
  withDb(
    async (db) =>
      (
        await db.query(
          `SELECT b.status, b."submittedAt", b.tin, b.telegram, b."publicPhone", b."logoKey" FROM "Business" b JOIN "User" u ON u.id = b."ownerId" WHERE u.phone = $1`,
          [OWNER],
        )
      ).rows[0] as { status: string; submittedAt: Date | null; tin: string; telegram: string; publicPhone: string; logoKey: string | null } | undefined,
  );

async function fillInfo(page: Page, tin: string) {
  await page.locator("#biz-name").fill("Sinov Kafesi");
  await page.locator("#biz-address").fill("Bunyodkor ko'chasi 20, Chilonzor");
  await page.locator("#biz-tin").fill(tin);
  await page.locator("#biz-telegram").fill("@sinovkafe");
}

test("band STIR — xato, hisob ochilmaydi", async ({ page }) => {
  const taken = await withDb(async (db) => (await db.query(`SELECT tin FROM "Business" WHERE tin IS NOT NULL LIMIT 1`)).rows[0].tin as string);
  await reachRegistrationDetails(page, OWNER, "/uz/biznes/royxat");
  await fillInfo(page, taken);
  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByText("Bu STIR bilan ariza allaqachon bor.")).toBeVisible();
  expect(await business()).toBeUndefined();
});

test("rasm yuklanmasa — xabar, qayta yuborilganda ariza baribir qabul qilinadi (hisob ikki marta ochilmaydi)", async ({ page }) => {
  await reachRegistrationDetails(page, OWNER, "/uz/biznes/royxat");
  await fillInfo(page, TIN);
  await page.locator("#biz-photo").setInputFiles({ name: "logo.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() });
  await page.route("**/api/biznes/hujjat**", (route) => route.abort());
  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByText("Rasm yuklanmadi.")).toBeVisible();
  expect(await business()).toMatchObject({ status: "PENDING", submittedAt: null });

  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByTestId("business-received")).toBeVisible();
  expect(await business()).toMatchObject({ status: "PENDING", tin: TIN, telegram: "sinovkafe", logoKey: null });
  expect((await business())?.submittedAt).not.toBeNull();
});
