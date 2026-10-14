import { expect, test } from "@playwright/test";
import { seedPhones, signIn, withDb } from "./helpers";

// B2 / WB2 — chegirma yaratish va moderatsiyaga tushishi (seed: Bodom Choyxonasi egasi)
const TITLE = "E2E sinov chegirmasi";

async function cleanup() {
  await withDb((db) => db.query(`DELETE FROM "Discount" WHERE title LIKE 'E2E sinov%'`));
}
test.beforeEach(cleanup);
test.afterAll(cleanup);

test.describe("veb (WB2)", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("noto'g'ri qiymatlar formada to'xtaydi; e'lon qilingan chegirma tekshiruvga tushadi", async ({ page }) => {
    const { owner } = await seedPhones();
    await signIn(page, owner);
    await expect(page).toHaveURL("/biznes");
    await page.goto("/biznes/chegirma/yangi", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "E'lon qilish" }).locator("visible=true").click();
    await expect(page.getByText("Mahsulot nomini kiriting").locator("visible=true")).toBeVisible();

    await page.locator("#wb2-title").fill(TITLE);
    await page.locator("#wb2-price").fill("40 000");
    await page.locator("#wb2-limit").fill("0");
    await page.getByRole("button", { name: "E'lon qilish" }).locator("visible=true").click();
    await expect(page.getByText("Kunlik son 1 dan katta bo'lsin.").locator("visible=true")).toBeVisible();

    // Yarim tundan o'tadigan oraliq ruxsat etiladi
    await page.locator("#wb2-limit").fill("25");
    await page.locator("#wb2-from").fill("22:00");
    await page.locator("#wb2-to").fill("02:00");
    await expect(page.getByText("Yarim tundan o'tadi").locator("visible=true")).toBeVisible();
    // Foiz: +5 → 35%
    await page.getByRole("button", { name: "Oshirish" }).locator("visible=true").click();
    await expect(page.getByTestId("discount-value").locator("visible=true")).toHaveText("−35%");

    await page.getByRole("button", { name: "E'lon qilish" }).locator("visible=true").click();
    await expect(page).toHaveURL("/biznes/chegirmalar");
    const row = page.getByTestId("discount-row").locator("visible=true").filter({ hasText: TITLE });
    await expect(row).toContainText("Tekshiruvda");

    const saved = await withDb(async (db) => (await db.query(`SELECT status, percent, "fromMinute", "toMinute", "dailyLimit" FROM "Discount" WHERE title = $1`, [TITLE])).rows[0]);
    expect(saved).toEqual({ status: "PENDING_REVIEW", percent: 35, fromMinute: 1320, toMinute: 120, dailyLimit: 25 });
  });
});

test("telefon (B2): qoralama saqlanadi va talabalarga chiqmaydi", async ({ page }) => {
  const { owner } = await seedPhones();
  await signIn(page, owner);
  await expect(page).toHaveURL("/biznes");
  await page.goto("/biznes/chegirma/yangi", { waitUntil: "networkidle" });
  await page.locator("#b2-title").fill(`${TITLE} 2`);
  await page.locator("#b2-price").fill("20000");
  await page.locator("#b2-limit").fill("10");
  await page.getByRole("radio", { name: "1 + 1" }).locator("visible=true").click();
  await page.getByRole("button", { name: "Qoralama" }).locator("visible=true").click();
  await expect(page).toHaveURL("/biznes/chegirmalar");
  await expect(page.getByTestId("discount-row").locator("visible=true").filter({ hasText: `${TITLE} 2` })).toContainText("Qoralama");
  const saved = await withDb(async (db) => (await db.query(`SELECT status, type FROM "Discount" WHERE title = $1`, [`${TITLE} 2`])).rows[0]);
  expect(saved).toEqual({ status: "DRAFT", type: "BOGO" });
});

test.describe("admin chegirmalar navbati", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  async function pending(title: string) {
    return withDb(async (db) => {
      const { rows } = await db.query(
        `INSERT INTO "Discount" (id, "businessId", "categoryId", title, type, "originalPrice", percent, weekdays, "fromMinute", "toMinute", "dailyLimit", "startsOn", "endsOn", status, "updatedAt")
         SELECT 'e2e_' || md5(random()::text), b.id, c.id, $1, 'PERCENT', 30000, 20, '{1,2,3}', 720, 900, 20, current_date, current_date + 10, 'PENDING_REVIEW', now() - interval '30 days'
         FROM "Business" b, "Category" c WHERE b.name = 'Bodom Choyxonasi' AND c.slug = 'taom' RETURNING id`,
        [title],
      );
      return rows[0].id as string;
    });
  }
  const statusOf = (id: string) => withDb(async (db) => (await db.query(`SELECT status, "rejectReason" FROM "Discount" WHERE id = $1`, [id])).rows[0]);

  test("tasdiqlash va rad etish (sabab biznesga ko'rinadi)", async ({ page }) => {
    const a = await pending(`${TITLE} A`);
    const b = await pending(`${TITLE} B`);
    const { admin, owner } = await seedPhones();
    await signIn(page, admin);
    await expect(page).toHaveURL("/admin/talabalar");

    await page.goto(`/admin/chegirmalar?id=${a}`);
    await expect(page.getByRole("heading", { name: `${TITLE} A` })).toBeVisible();
    await page.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect.poll(async () => (await statusOf(a)).status).toBe("ACTIVE");

    await page.goto(`/admin/chegirmalar?id=${b}`);
    await page.locator("#reject-reason-discount").selectOption("unclear");
    await page.getByRole("button", { name: "Rad etish" }).click();
    await expect.poll(async () => (await statusOf(b)).status).toBe("REJECTED");
    expect((await statusOf(b)).rejectReason).toBe("Nom yoki shartlar tushunarsiz");

    await page.context().clearCookies();
    await signIn(page, owner);
    await expect(page).toHaveURL("/biznes");
    await page.goto("/biznes/chegirmalar");
    const rows = page.getByTestId("discount-row").locator("visible=true");
    await expect(rows.filter({ hasText: `${TITLE} B` })).toContainText("Rad etildi: Nom yoki shartlar tushunarsiz");
    // Faol chegirmani to'xtatish — tekshiruvsiz
    await rows.filter({ hasText: `${TITLE} A` }).getByRole("switch").click();
    await expect.poll(async () => (await statusOf(a)).status).toBe("PAUSED");
  });
});
