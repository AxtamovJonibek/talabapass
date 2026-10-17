import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb } from "./helpers";

// T4 / WT2 lenta va T5 / WT3 tafsilot (seed bizneslari). Tekshiruvdagi chegirma test o'zi yaratadi.
const PENDING_ID = "e2ependingfeed01";
const PENDING_TITLE = "E2E tekshiruvdagi chegirma";

test.beforeAll(async () => {
  await withDb((db) =>
    db.query(
      `INSERT INTO "Discount" (id, "businessId", "categoryId", title, type, "originalPrice", percent, weekdays, "fromMinute", "toMinute", "dailyLimit", "startsOn", "endsOn", status, "updatedAt")
       SELECT $1, "businessId", "categoryId", $2, type, "originalPrice", percent, '{1,2,3,4,5,6,7}', 0, 1439, "dailyLimit", "startsOn", "endsOn", 'PENDING_REVIEW', now()
       FROM "Discount" WHERE title = 'Kapuchino 300 ml' LIMIT 1
       ON CONFLICT (id) DO UPDATE SET status = 'PENDING_REVIEW'`,
      [PENDING_ID, PENDING_TITLE],
    ),
  );
});
test.afterAll(async () => {
  await withDb((db) => db.query(`DELETE FROM "Discount" WHERE id = $1`, [PENDING_ID]));
});

const card = (page: Page, name: RegExp) => page.getByRole("link", { name }).locator("visible=true");

async function discountId(title: string): Promise<string> {
  const { rows } = await withDb((db) => db.query<{ id: string }>(`SELECT id FROM "Discount" WHERE title = $1`, [title]));
  return rows[0]!.id;
}

test.describe("telefon (T4 / T5)", () => {
  test("lentada faqat tasdiqlangan chegirmalar; kategoriya, qidiruv va tafsilot", async ({ page }) => {
    const { student } = await seedPhones();
    await signIn(page, student);
    await expect(page).toHaveURL("/chegirmalar");

    await expect(card(page, /Kino chiptasi, 2D seans/).first()).toBeVisible();
    await expect(card(page, /Lavash \+ ayron/).first()).toBeVisible();
    // Tekshiruvdagi va tugagan chegirmalar talabaga chiqmaydi
    await expect(page.getByText(PENDING_TITLE)).toHaveCount(0);
    await expect(page.getByText("Tushlik to'plami")).toHaveCount(0);

    await page.getByRole("button", { name: /^Kofe/ }).locator("visible=true").click();
    await expect(page).toHaveURL(/kategoriya=kofe/);
    await expect(card(page, /Kapuchino 300 ml/)).toHaveCount(1);
    await expect(card(page, /Kino chiptasi/)).toHaveCount(0);

    await page.getByRole("button", { name: /^Hammasi/ }).locator("visible=true").click();
    await page.locator("#t4-search").fill("lavash");
    await expect(card(page, /Kino chiptasi/)).toHaveCount(0);
    await card(page, /Lavash \+ ayron/).first().click();

    await expect(page).toHaveURL(/\/chegirmalar\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: "Lavash + ayron" }).locator("visible=true")).toBeVisible();
    await expect(page.getByText("Limit").locator("visible=true")).toBeVisible();
    // Kupon olish (QR) keyingi bosqichda
    await expect(page.getByRole("button", { name: "Chegirmani olish" }).locator("visible=true")).toBeDisabled();

    await page.getByRole("link", { name: "Orqaga" }).click();
    await expect(page).toHaveURL("/chegirmalar");
  });

  test("tekshiruvdagi chegirma tafsiloti ochilmaydi (404)", async ({ page }) => {
    const { student } = await seedPhones();
    await signIn(page, student);
    // Sahifa oqim bilan beriladi — holat kodi emas, 404 sahifasi tekshiriladi
    await page.goto(`/chegirmalar/${PENDING_ID}`);
    await expect(page.getByTestId("not-found-page")).toBeVisible();
    await expect(page.getByText(PENDING_TITLE)).toHaveCount(0);
  });
});

test.describe("veb (WT2 / WT3)", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("saralash, 'faqat hozir ochiq' va tafsilot", async ({ page }) => {
    const { student } = await seedPhones();
    await signIn(page, student);
    await expect(page).toHaveURL("/chegirmalar");
    await expect(page.getByRole("heading", { name: /^Salom, / })).toBeVisible();

    await page.locator("#wt2-sort").click();
    await page.getByRole("option", { name: "Eng katta chegirma" }).click();
    await expect(page).toHaveURL(/saralash=biggest/);
    // 1+1 (50%) eng katta, keyin kino (−44%)
    const tiles = page.locator("section a[href^='/chegirmalar/']");
    await expect(tiles.first()).toContainText("1+1");

    await page.getByRole("button", { name: "Hozir ochiq" }).locator("visible=true").click();
    await expect(page).toHaveURL(/ochiq=1/);

    await page.goto(`/chegirmalar/${await discountId("Osh 0.5 porsiya + ko'k choy")}`);
    await expect(page.getByRole("heading", { name: "Osh 0.5 porsiya + ko'k choy" }).locator("visible=true")).toBeVisible();
    await expect(page.getByText("Yaqin atrofda")).toBeVisible();
    await expect(page.getByRole("link", { name: /Barcha chegirmalar/ })).toBeVisible();
  });
});
