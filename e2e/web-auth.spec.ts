import { expect, test } from "@playwright/test";
import { clearOtp, codeBox, enterCode, fillNewPassword, FIXED_CODE, local, sampleJpeg, withDb, toPhoneStep } from "./helpers";

const BUSINESS_PHONE = "+998905550990";
const BUSINESS_TIN = "309555990";

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "Business" WHERE tin = $1`, [BUSINESS_TIN]);
    await db.query(`DELETE FROM "User" WHERE phone = $1`, [BUSINESS_PHONE]);
  });
  await clearOtp(BUSINESS_PHONE);
}

test.beforeEach(cleanup);
test.afterAll(cleanup);

test.describe("sayt ro'yxati va kirishi", () => {
  test("parol qoidalari: kulrang → yashil, qizil faqat 'Davom etish' dan keyin", async ({ page }) => {
    await clearOtp(BUSINESS_PHONE);
    await page.goto("/uz/talaba/royxat", { waitUntil: "networkidle" });
    await toPhoneStep(page, "Telefon raqam bilan");
    await page.locator("#login-phone").fill(local(BUSINESS_PHONE));
    await page.getByRole("button", { name: "Kod yuborish" }).click();
    await expect(codeBox(page)).toBeEnabled();
    await enterCode(page, FIXED_CODE);

    const length = page.getByText("Kamida 8 ta belgi");
    const mix = page.getByText("Harf va raqam birga");
    await expect(length).toHaveClass(/text-muted/);
    await page.locator("#auth-password").fill("abc");
    await expect(length).toHaveClass(/text-muted/); // qizil emas — hali "Davom etish" bosilmagan
    await page.locator("#auth-password").fill("abcdefgh");
    await expect(length).toHaveClass(/text-green/);
    await expect(mix).toHaveClass(/text-muted/);
    await page.locator("#auth-password").fill("abcdefg1");
    await expect(mix).toHaveClass(/text-green/);

    await page.locator("#auth-password").fill("abc");
    await page.locator("#auth-repeat").fill("abc");
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(length).toHaveClass(/text-danger/);
    await expect(mix).toHaveClass(/text-danger/);
  });

  test("parollar mos kelmasa — xabar", async ({ page }) => {
    await clearOtp(BUSINESS_PHONE);
    await page.goto("/uz/talaba/royxat", { waitUntil: "networkidle" });
    await toPhoneStep(page, "Telefon raqam bilan");
    await page.locator("#login-phone").fill(local(BUSINESS_PHONE));
    await page.getByRole("button", { name: "Kod yuborish" }).click();
    await enterCode(page, FIXED_CODE);
    await page.locator("#auth-password").fill("Sinov2026");
    await page.locator("#auth-repeat").fill("Sinov2027");
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page.getByText("Parollar bir xil emas")).toBeVisible();
  });

  test("biznes ro'yxati: telefon → kod → parol → ma'lumotlar (rasm bilan) → 'Arizangiz qabul qilindi'", async ({ page }) => {
    await clearOtp(BUSINESS_PHONE);
    await page.goto("/uz/biznes/royxat", { waitUntil: "networkidle" });
    await toPhoneStep(page, "Telefon raqam bilan");
    await page.locator("#login-phone").fill(local(BUSINESS_PHONE));
    await page.getByRole("button", { name: "Kod yuborish" }).click();
    await expect(codeBox(page)).toBeEnabled();
    await enterCode(page, FIXED_CODE);
    await page.locator("#auth-password").waitFor();
    await fillNewPassword(page);

    await page.locator("#biz-name").fill("Sinov Kafesi");
    await page.locator("#biz-address").fill("Toshkent, Chilonzor 9");
    await page.locator("#biz-tin").fill(BUSINESS_TIN);
    await expect(page.locator("#biz-phone")).toHaveValue("90 555 09 90"); // tasdiqlangan raqam oldindan
    await page.locator("#biz-telegram").fill("@sinovkafe");
    await page.locator("#biz-photo").setInputFiles({ name: "logo.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() });
    await page.getByRole("button", { name: "Yuborish" }).click();

    await expect(page.getByTestId("business-received")).toBeVisible();
    await expect(page.getByText("Arizangiz qabul qilindi.")).toBeVisible();
    await expect(page.getByText("Siz bilan bog'lanamiz.")).toBeVisible();

    const row = await withDb((db) => db.query(`SELECT status, "submittedAt" IS NOT NULL AS submitted, "logoKey" IS NOT NULL AS logo FROM "Business" WHERE tin = $1`, [BUSINESS_TIN]));
    expect(row.rows[0]).toMatchObject({ status: "PENDING", submitted: true, logo: true });
  });

  test("biznes: noto'g'ri STIR — maydon xatosi, hisob ochilmaydi", async ({ page }) => {
    await clearOtp(BUSINESS_PHONE);
    await page.goto("/uz/biznes/royxat", { waitUntil: "networkidle" });
    await toPhoneStep(page, "Telefon raqam bilan");
    await page.locator("#login-phone").fill(local(BUSINESS_PHONE));
    await page.getByRole("button", { name: "Kod yuborish" }).click();
    await enterCode(page, FIXED_CODE);
    await page.locator("#auth-password").waitFor();
    await fillNewPassword(page);
    await page.locator("#biz-name").fill("Sinov Kafesi");
    await page.locator("#biz-address").fill("Toshkent, Chilonzor 9");
    await page.locator("#biz-tin").fill("123");
    await page.locator("#biz-telegram").fill("@sinovkafe");
    await page.getByRole("button", { name: "Yuborish" }).click();
    await expect(page.getByText("Maydonni to'g'ri to'ldiring.")).toBeVisible();
    const users = await withDb((db) => db.query(`SELECT count(*)::int AS n FROM "User" WHERE phone = $1`, [BUSINESS_PHONE]));
    expect(users.rows[0].n).toBe(0);
  });

  test("Apple tugmasi doim ko'rinadi; sozlanmagan bo'lsa — aniq xabar", async ({ page }) => {
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
    const apple = page.getByRole("button", { name: "Apple bilan davom etish" });
    await expect(apple).toBeVisible();
    await page.goto("/uz/talaba/royxat", { waitUntil: "networkidle" });
    await expect(apple).toBeVisible();
  });

  test("til almashadi: ru va en", async ({ page }) => {
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^ru$/i }).click();
    await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
    await page.getByRole("button", { name: /^en$/i }).click();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^uz$/i }).click();
    await expect(page.getByRole("button", { name: "Kirish", exact: true })).toBeVisible();
  });
});
