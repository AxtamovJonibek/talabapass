import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

// Super admin: biznes ruxsatlari panelda ko'rinadi, jurnal, landing rejimi
test.use({ viewport: { width: 1440, height: 1000 } });

let phones: SeedPhones;
let businessId: string;
let landingBefore: unknown[] = [];

async function restore() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "BusinessPermissions" WHERE "businessId" = $1`, [businessId]);
    await db.query(`DELETE FROM "LandingSettings" WHERE id = 'landing'`);
    for (const row of landingBefore as Record<string, unknown>[]) {
      await db.query(
        `INSERT INTO "LandingSettings" (id, "statsMode", "statsStudents", "statsBusinesses", "statsDiscounts", "statsSaved", "dealsMode", "dealIds", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [row.id, row.statsMode, row.statsStudents, row.statsBusinesses, row.statsDiscounts, row.statsSaved, row.dealsMode, row.dealIds],
      );
    }
  });
}

test.beforeAll(async () => {
  phones = await seedPhones();
  await withDb(async (db) => {
    businessId = (await db.query<{ id: string }>(`SELECT id FROM "Business" WHERE name = 'Bodom Choyxonasi'`)).rows[0]!.id;
    landingBefore = (await db.query(`SELECT * FROM "LandingSettings" WHERE id = 'landing'`)).rows;
  });
  await restore();
});
test.afterAll(restore);

async function adminIn(page: Page) {
  await signIn(page, phones.admin);
  await expect(page).toHaveURL("/uz/admin");
}

// TODO: saqlashdan keyingi router.refresh bilan page.goto to'qnashadi (ERR_ABORTED) — tuzatilmagan
test.fixme("admin kassir qo'shishni o'chiradi — biznes panelida ogohlantirish, jurnalda oldin → keyin", async ({ page, browser }) => {
  test.slow();
  await adminIn(page);
  await page.goto(`/uz/admin/hamkorlar?id=${businessId}`);
  const form = page.getByTestId("permissions-form");
  await form.getByRole("switch", { name: "Kassir qo'sha oladi" }).click();
  await form.getByTestId("permissions-save").click();
  await expect(form.getByRole("status")).toBeVisible();

  await page.goto(`/uz/admin/jurnal?obyekt=Business&id=${businessId}`);
  await expect(page.getByTestId("journal-table")).toContainText("business.permissions");
  await expect(page.getByTestId("journal-table")).toContainText("canAddCashiers: true → false");

  const owner = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await signIn(owner, phones.owner);
  await owner.goto("/uz/biznes/kassirlar");
  await expect(owner.getByTestId("permission-notice").locator("visible=true").first()).toContainText("Kassir qo'shish o'chirilgan.");
});

test("landing: raqamlar yashirilsa bosh sahifada bo'lim chiqmaydi", async ({ page }) => {
  test.slow();
  await adminIn(page);
  await page.goto("/uz/admin/landing");
  const settings = page.getByTestId("landing-settings");
  await settings.getByRole("radio", { name: "Yashirin" }).click();
  await page.getByTestId("landing-save").click();
  await expect(settings.getByRole("status")).toBeVisible();
  await page.goto("/uz");
  await expect(page.getByRole("region", { name: "Raqamlarda" })).toHaveCount(0);
});
