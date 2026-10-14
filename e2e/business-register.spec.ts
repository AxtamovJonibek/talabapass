import { expect, test, type Page } from "@playwright/test";
import { codeBox, enterCode, FIXED_CODE, local, sampleJpeg, signIn, withDb } from "./helpers";

// B1 / WB1 — biznes ro'yxati: ma'lumot → hujjatlar → SMS kod → fayllar → tekshiruvga
const OWNER = "+998935550912";
const TIN = "309100912";
let JPEG: Buffer;

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "Business" WHERE tin = $1 OR "ownerId" IN (SELECT id FROM "User" WHERE phone = $2)`, [TIN, OWNER]);
    await db.query(`DELETE FROM "User" WHERE phone = $1`, [OWNER]);
    await db.query(`DELETE FROM "OtpCode" WHERE phone = $1`, [OWNER]);
    await db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'otp-ip:%'`);
  });
}
test.beforeAll(async () => {
  JPEG = await sampleJpeg();
});
test.beforeEach(cleanup);
test.afterAll(cleanup);

const business = () =>
  withDb(
    async (db) =>
      (
        await db.query(
          `SELECT b.id, b.status, b."submittedAt", b.tin, b.kind, b."districtId", u.role,
             (SELECT count(*)::int FROM "BusinessDoc" d WHERE d."businessId" = b.id AND d.kind = 'REGISTRATION') AS registration,
             (SELECT count(*)::int FROM "BusinessDoc" d WHERE d."businessId" = b.id AND d.kind = 'PHOTO') AS photos
           FROM "Business" b JOIN "User" u ON u.id = b."ownerId" WHERE u.phone = $1`,
          [OWNER],
        )
      ).rows[0] as { id: string; status: string; submittedAt: Date | null; tin: string; kind: string; districtId: string | null; role: string; registration: number; photos: number } | undefined,
  );

const file = (name: string) => ({ name, mimeType: "image/jpeg", buffer: JPEG });

async function fillInfo(page: Page, prefix: "wb" | "b1") {
  await page.locator(`#${prefix}-name`).fill("Sinov Kafesi");
  await page.getByRole("button", { name: "Kafe / restoran" }).locator("visible=true").click();
  await page.locator(`#${prefix}-address`).fill("Bunyodkor ko'chasi 20, Chilonzor");
  await page.locator(`#${prefix}-hours`).fill("09:00 – 22:00");
  await page.locator(`#${prefix}-desc`).fill("Osh va choy");
}

test.describe("veb (WB1)", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("to'liq ariza: kod, fayllar, tekshiruvga yuborish → 3-qadam", async ({ page }) => {
    await page.goto("/biznes/royxat", { waitUntil: "networkidle" });
    // 1-qadam tekshiruvi brauzerda: bo'sh forma o'tmaydi
    await page.getByRole("button", { name: "Keyingi: hujjatlar" }).click();
    await expect(page.getByText("Biznes nomini kiriting").locator("visible=true")).toBeVisible();

    await fillInfo(page, "wb");
    await page.getByRole("button", { name: "Keyingi: hujjatlar" }).click();
    await expect(page.getByRole("heading", { name: "Tasdiqlash uchun hujjatlar" }).locator("visible=true")).toBeVisible();

    await page.locator("#wb-tin").fill("309 100 912");
    await page.locator("#wb-contact").fill("Sinov Egasi");
    await page.locator("#wb-phone").fill(local(OWNER));
    // Fayl va rozilikdan oldin yuborilmaydi
    await page.getByRole("button", { name: "Tekshiruvga yuborish" }).click();
    await expect(page.getByText("Ro'yxatdan o'tganlik guvohnomasini yuklang.").locator("visible=true")).toBeVisible();

    const web = page.locator("div.hidden");
    await web.locator('input[name="registrationFile"]').setInputFiles(file("guvohnoma.jpg"));
    await web.locator('input[name="photoFiles"]').setInputFiles([file("zal.jpg"), file("kassa.jpg")]);
    await expect(page.getByText("guvohnoma.jpg · tanlandi").locator("visible=true")).toBeVisible();
    await page.getByRole("button", { name: "Tekshiruvga yuborish" }).click();
    await expect(page.getByText("Davom etish uchun shartlarga rozilik bildiring.").locator("visible=true")).toBeVisible();
    await web.locator('input[name="consent"]').check();

    await page.getByRole("button", { name: "Tekshiruvga yuborish" }).click();
    await expect(codeBox(page)).toBeEnabled();
    expect(await business()).toBeUndefined(); // kod tasdiqlanmaguncha hisob ochilmaydi
    await enterCode(page, FIXED_CODE);

    await expect(page).toHaveURL("/biznes");
    await expect(page.getByTestId("business-stamp").locator("visible=true")).toHaveText("TEKSHIRUVDA");
    const saved = await business();
    expect(saved).toMatchObject({ status: "PENDING", tin: TIN, kind: "CAFE", role: "BUSINESS_OWNER", registration: 1, photos: 2 });
    expect(saved!.submittedAt).not.toBeNull();
    expect(saved!.districtId).not.toBeNull(); // "Chilonzor" manzildan

    // Admin navbatida paydo bo'ladi
    const admin = await withDb(async (db) => (await db.query(`SELECT phone FROM "User" WHERE role = 'ADMIN' LIMIT 1`)).rows[0].phone as string);
    await page.context().clearCookies();
    await signIn(page, admin);
    await expect(page).toHaveURL("/admin/talabalar");
    await page.goto("/admin/bizneslar");
    await expect(page.getByText("Sinov Kafesi").first()).toBeVisible();
  });

  test("yarim yo'lda qolgan ariza navbatga chiqmaydi va /biznes da davom etadi", async ({ page }) => {
    await page.goto("/biznes/royxat", { waitUntil: "networkidle" });
    await fillInfo(page, "wb");
    await page.getByRole("button", { name: "Keyingi: hujjatlar" }).click();
    await page.locator("#wb-tin").fill(TIN);
    await page.locator("#wb-contact").fill("Sinov Egasi");
    await page.locator("#wb-phone").fill(local(OWNER));
    const web = page.locator("div.hidden");
    await web.locator('input[name="registrationFile"]').setInputFiles(file("guvohnoma.jpg"));
    await web.locator('input[name="photoFiles"]').setInputFiles(file("zal.jpg"));
    await web.locator('input[name="consent"]').check();
    // Fayl yuklash rad etiladi — hisob ochiladi, lekin ariza yuborilmaydi
    await page.route("**/api/biznes/hujjat**", (route) => route.abort());
    await page.getByRole("button", { name: "Tekshiruvga yuborish" }).click();
    await enterCode(page, FIXED_CODE);
    await expect(page.getByText("Fayl yuklanmadi").locator("visible=true")).toBeVisible();
    expect(await business()).toMatchObject({ status: "PENDING", submittedAt: null, registration: 0 });

    // Sahifani qayta ochganda — o'sha ariza, ma'lumotlari bilan
    await page.unroute("**/api/biznes/hujjat**");
    await page.goto("/biznes", { waitUntil: "networkidle" });
    await expect(page.locator("#wb-name")).toHaveValue("Sinov Kafesi");
  });

  test("band STIR — xato, hisob ochilmaydi", async ({ page }) => {
    const taken = await withDb(async (db) => (await db.query(`SELECT tin FROM "Business" WHERE tin IS NOT NULL LIMIT 1`)).rows[0].tin as string);
    await page.goto("/biznes/royxat", { waitUntil: "networkidle" });
    await fillInfo(page, "wb");
    await page.getByRole("button", { name: "Keyingi: hujjatlar" }).click();
    await page.locator("#wb-tin").fill(taken);
    await page.locator("#wb-contact").fill("Sinov Egasi");
    await page.locator("#wb-phone").fill(local(OWNER));
    const web = page.locator("div.hidden");
    await web.locator('input[name="registrationFile"]').setInputFiles(file("guvohnoma.jpg"));
    await web.locator('input[name="photoFiles"]').setInputFiles(file("zal.jpg"));
    await web.locator('input[name="consent"]').check();
    await page.getByRole("button", { name: "Tekshiruvga yuborish" }).click();
    await enterCode(page, FIXED_CODE);
    await expect(page.getByText("Bu STIR bilan biznes allaqachon").locator("visible=true")).toBeVisible();
    expect(await business()).toBeUndefined();
  });
});

test.describe("telefon (B1)", () => {
  test("STIR birinchi qadamda, ariza yuboriladi", async ({ page }) => {
    await page.goto("/biznes/royxat", { waitUntil: "networkidle" });
    await fillInfo(page, "b1");
    await page.getByRole("button", { name: "Keyingi: hujjatlar" }).click();
    await expect(page.getByText("STIR 9 ta raqamdan iborat.").locator("visible=true")).toBeVisible();
    await page.locator("#b1-tin").fill(TIN);
    await page.getByRole("button", { name: "Keyingi: hujjatlar" }).click();

    await page.locator("#b1-contact").fill("Sinov Egasi");
    await page.locator("#b1-phone").fill(local(OWNER));
    const phone = page.locator("div.\\@min-\\[700px\\]\\:hidden");
    await phone.locator('input[name="registrationFile"]').setInputFiles(file("guvohnoma.jpg"));
    await phone.locator('input[name="photoFiles"]').setInputFiles(file("zal.jpg"));
    await phone.locator('input[name="consent"]').check();
    await page.getByRole("button", { name: "Tekshiruvga yuborish" }).click();
    await enterCode(page, FIXED_CODE);
    await expect(page).toHaveURL("/biznes");
    await expect(page.getByTestId("business-stamp").locator("visible=true")).toBeVisible();
    expect(await business()).toMatchObject({ status: "PENDING", registration: 1, photos: 1 });
  });
});
