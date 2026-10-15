import { expect, test } from "@playwright/test";
import { seedPhones, signIn, withDb } from "./helpers";

// 8-bosqich: talaba kupon oladi (T5 → T6), kassir qo'lda kiritib tasdiqlaydi (B3 → B4), chek talabaning tarixiga (T7) tushadi.
const DISCOUNT_ID = "e2ecouponflow01";
const TITLE = "E2E kupon sinovi";

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "ScanAttempt" WHERE "couponId" IN (SELECT id FROM "Coupon" WHERE "discountId" = $1)`, [DISCOUNT_ID]);
    await db.query(`DELETE FROM "Redemption" WHERE "discountId" = $1`, [DISCOUNT_ID]);
    await db.query(`DELETE FROM "Coupon" WHERE "discountId" = $1`, [DISCOUNT_ID]);
    await db.query(`DELETE FROM "Discount" WHERE id = $1`, [DISCOUNT_ID]);
  });
}

test.beforeAll(async () => {
  await cleanup();
  const { cashier } = await seedPhones();
  // Kun bo'yi ochiq, talaba limiti yo'q (test qayta ishga tushsa ham ishlaydi) — kassirning biznesida
  await withDb((db) =>
    db.query(
      `INSERT INTO "Discount" (id, "businessId", "categoryId", title, type, "originalPrice", percent, weekdays, "fromMinute", "toMinute", "dailyLimit", "perStudentLimit", "startsOn", "endsOn", status, "updatedAt")
       SELECT $1, m."businessId", (SELECT id FROM "Category" WHERE slug = 'taom'), $2, 'PERCENT', 38000, 30, '{1,2,3,4,5,6,7}', 0, 1440, 100, 'UNLIMITED',
              current_date - 1, current_date + 5, 'ACTIVE', now()
       FROM "BusinessMember" m JOIN "User" u ON u.id = m."userId" WHERE u.phone = $3 AND m.active LIMIT 1`,
      [DISCOUNT_ID, TITLE, cashier],
    ),
  );
});
test.afterAll(cleanup);

test("kupon: olish → kassir qo'lda kiritadi → tasdiqlash → chek tarixda; takror — rad", async ({ browser }) => {
  test.slow();
  const phones = await seedPhones();
  const studentContext = await browser.newContext();
  const cashierContext = await browser.newContext();
  const student = await studentContext.newPage();
  const cashier = await cashierContext.newPage();

  await signIn(student, phones.student);
  await student.goto(`/chegirmalar/${DISCOUNT_ID}`);
  await student.getByRole("button", { name: "Chegirmani olish" }).locator("visible=true").click();
  await expect(student).toHaveURL(/\/kuponlar\/[a-z0-9]+$/);
  await expect(student.getByRole("img", { name: "Chegirma QR kodi" })).toBeVisible();
  await expect(student.getByTestId("coupon-timer")).toHaveText(/^(10:00|09:\d\d)$/);
  const code = (await student.getByTestId("coupon-code").textContent())!.trim();
  await expect(student.getByTestId("coupon-totp")).toHaveText(/^\d{3} \d{3}$/);
  const totp = (await student.getByTestId("coupon-totp").textContent())!.replace(/\s/g, "");

  await signIn(cashier, phones.cashier);
  await expect(cashier).toHaveURL("/biznes/skaner");
  await cashier.getByRole("button", { name: "Kodni kiritish" }).click();

  // Faqat kupon kodi (6 raqamsiz) — o'tmaydi
  await cashier.locator("#manual-code").fill(code);
  await cashier.locator("#manual-totp").fill("12");
  await cashier.getByRole("button", { name: "Tekshirish" }).click();
  await expect(cashier.getByText("QR yoki kod noto'g'ri. Yana 4 ta urinish.")).toBeVisible();

  await cashier.locator("#manual-totp").fill(totp);
  await cashier.getByRole("button", { name: "Tekshirish" }).click();
  await expect(cashier.getByText("QR haqiqiy")).toBeVisible();
  await expect(cashier.getByTestId("sale-total")).toHaveText("26 600");
  await cashier.getByRole("button", { name: "Karta" }).click();
  await cashier.getByRole("button", { name: "Sotuvni tasdiqlash" }).click();
  await expect(cashier.getByText("Chek chiqarildi")).toBeVisible();
  await expect(cashier.getByText("26 600").first()).toBeVisible();

  // Talaba ekrani o'zi tarixga o'tadi (kassir tasdiqlagani so'rov bilan bilinadi)
  await expect(student).toHaveURL(/\/tarix\?chek=/, { timeout: 20_000 });
  await expect(student.getByText("Sotuv tasdiqlandi").locator("visible=true")).toBeVisible();
  const pdfHref = await student.getByRole("link", { name: "PDF yuklab olish" }).locator("visible=true").getAttribute("href");
  const pdf = await student.request.get(pdfHref!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  // Boshqa foydalanuvchi (kassir emas, begona) chekni ololmaydi — kirmagan
  expect((await (await browser.newContext()).request.get(new URL(pdfHref!, student.url()).toString())).status()).toBe(404);

  // Takror: shu kupon yana kiritilsa — "allaqachon ishlatilgan"
  await cashier.getByRole("button", { name: "Keyingi skan" }).click();
  await cashier.getByRole("button", { name: "Kodni kiritish" }).click();
  await cashier.locator("#manual-code").fill(code);
  await cashier.locator("#manual-totp").fill(totp);
  await cashier.getByRole("button", { name: "Tekshirish" }).click();
  await expect(cashier.getByText("Bu kupon allaqachon ishlatilgan.")).toBeVisible();

  const counts = await withDb(async (db) => (await db.query(`SELECT claimed, redeemed FROM "DiscountDay" WHERE "discountId" = $1`, [DISCOUNT_ID])).rows[0]);
  expect(counts).toEqual({ claimed: 1, redeemed: 1 });
  await studentContext.close();
  await cashierContext.close();
});

test("kuponni bekor qilish qoldiqni qaytaradi", async ({ page }) => {
  const { student } = await seedPhones();
  await signIn(page, student);
  await page.goto(`/chegirmalar/${DISCOUNT_ID}`);
  await page.getByRole("button", { name: "Chegirmani olish" }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/kuponlar\/[a-z0-9]+$/);
  const before = await withDb(async (db) => (await db.query(`SELECT claimed FROM "DiscountDay" WHERE "discountId" = $1`, [DISCOUNT_ID])).rows[0].claimed);
  await page.getByRole("button", { name: "Kuponni bekor qilish" }).click();
  await expect(page).toHaveURL(`/chegirmalar/${DISCOUNT_ID}`);
  const after = await withDb(async (db) => (await db.query(`SELECT claimed FROM "DiscountDay" WHERE "discountId" = $1`, [DISCOUNT_ID])).rows[0].claimed);
  expect(after).toBe(before - 1);
});

test.describe("veb (WT3 QR paneli)", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("kupon olinsa yon panelda QR va taymer chiqadi; bekor qilinsa taklif qaytadi", async ({ page }) => {
    const { student } = await seedPhones();
    await signIn(page, student);
    await page.goto(`/chegirmalar/${DISCOUNT_ID}`);
    await page.getByRole("button", { name: "Chegirmani olish" }).locator("visible=true").click();
    await expect(page.getByRole("img", { name: "Chegirma QR kodi" }).locator("visible=true")).toBeVisible();
    await expect(page.getByText("Amal qiladi").locator("visible=true")).toBeVisible();
    await page.getByRole("button", { name: "Kuponni bekor qilish" }).locator("visible=true").click();
    await expect(page.getByRole("button", { name: "Chegirmani olish" }).locator("visible=true")).toBeEnabled();
  });
});
