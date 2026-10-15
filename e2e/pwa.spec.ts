import { expect, test } from "@playwright/test";
import { seedPhones, signIn, withDb } from "./helpers";

/**
 * PWA: service worker ro'yxatdan o'tadi, ochilgan kupon sahifasi internetsiz ham ochiladi, boshqa sahifa — /oflayn.
 * Service worker faqat production'da ro'yxatdan o'tadi; testni dev serverda yuritish uchun alohida port va bayroq kerak:
 *   E2E_PORT=3100 NEXT_PUBLIC_SW=1 npx playwright test e2e/pwa.spec.ts
 */
test.skip(!process.env.NEXT_PUBLIC_SW && !process.env.E2E_PWA, "E2E_PWA=1 (production server) yoki NEXT_PUBLIC_SW=1 kerak");
test.setTimeout(120_000);

const DISCOUNT_ID = "e2epwaoffline01";

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "ScanAttempt" WHERE "couponId" IN (SELECT id FROM "Coupon" WHERE "discountId" = $1)`, [DISCOUNT_ID]);
    await db.query(`DELETE FROM "Coupon" WHERE "discountId" = $1`, [DISCOUNT_ID]);
    await db.query(`DELETE FROM "Discount" WHERE id = $1`, [DISCOUNT_ID]);
  });
}

test.beforeAll(async () => {
  await cleanup();
  const { cashier } = await seedPhones();
  await withDb((db) =>
    db.query(
      `INSERT INTO "Discount" (id, "businessId", "categoryId", title, type, "originalPrice", percent, weekdays, "fromMinute", "toMinute", "dailyLimit", "perStudentLimit", "startsOn", "endsOn", status, "updatedAt")
       SELECT $1, m."businessId", (SELECT id FROM "Category" WHERE slug = 'taom'), 'E2E PWA sinovi', 'PERCENT', 38000, 30, '{1,2,3,4,5,6,7}', 0, 1440, 100, 'UNLIMITED',
              current_date - 1, current_date + 5, 'ACTIVE', now()
       FROM "BusinessMember" m JOIN "User" u ON u.id = m."userId" WHERE u.phone = $2 AND m.active LIMIT 1`,
      [DISCOUNT_ID, cashier],
    ),
  );
});
test.afterAll(cleanup);

test("ochilgan kupon internetsiz ochiladi; boshqa sahifa — oflayn ekran", async ({ page, context }) => {
  const { student } = await seedPhones();
  await signIn(page, student);
  await page.goto(`/chegirmalar/${DISCOUNT_ID}`);
  await page.getByRole("button", { name: "Chegirmani olish" }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/kuponlar\/[a-z0-9]+$/);
  const couponPath = new URL(page.url()).pathname;
  await expect(page.getByRole("img", { name: "Chegirma QR kodi" })).toBeVisible();

  // Service worker faol bo'ldi va kupon sahifasi keshga tushdi
  await expect
    .poll(async () => page.evaluate(async (path) => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active) return "sw yo'q";
      const hit = await caches.open("tp-v2-pages").then((c) => c.match(path));
      return hit ? "ok" : "kesh yo'q";
    }, couponPath), { timeout: 30_000 })
    .toBe("ok");

  // Sahifa yuklangach 3 soniyadan keyin fayllar ro'yxati service worker'ga beriladi — shuni kutamiz
  await page.waitForTimeout(7000);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("img", { name: "Chegirma QR kodi" })).toBeVisible();
  await expect(page.getByTestId("coupon-totp")).toHaveText(/^\d{3} \d{3}$/);
  // QR internetsiz yangilanadi — taymer yuradi
  await expect(page.getByTestId("coupon-timer")).toHaveText(/^\d\d:\d\d$/);

  // Kesh'da yo'q sahifa — oflayn ekran
  await page.goto("/tarix");
  await expect(page.getByTestId("offline-page")).toBeVisible();

  await context.setOffline(false);
});
