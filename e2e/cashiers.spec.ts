import { expect, test } from "@playwright/test";
import { clearOtp, codeBox, enterCode, FIXED_CODE, local, seedPhones, signIn, withDb } from "./helpers";

// Kassir taklifi: bir martalik havola → kassir hisobi → faqat o'z biznesi; egasi o'chirsa sessiya yopiladi
const CASHIER = "+998935550931";

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "CashierInvite" WHERE "businessId" IN (SELECT id FROM "Business" WHERE name = 'Bodom Choyxonasi') AND "acceptedAt" IS NULL`);
    await db.query(`DELETE FROM "CashierInvite" WHERE "acceptedById" IN (SELECT id FROM "User" WHERE phone = $1)`, [CASHIER]);
    await db.query(`DELETE FROM "User" WHERE phone = $1`, [CASHIER]);
  });
  await clearOtp(CASHIER);
}
test.beforeEach(cleanup);
test.afterAll(cleanup);

test("taklif → qabul → o'chirish: sessiya darhol yopiladi, havola qayta ishlamaydi", async ({ browser, page }) => {
  test.slow();
  const { owner } = await seedPhones();
  await signIn(page, owner);
  await expect(page).toHaveURL("/biznes");
  await page.goto("/biznes/kassirlar", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "+ Taklif qilish" }).locator("visible=true").click();
  const link = (await page.getByTestId("invite-link").locator("visible=true").locator("code").textContent())!.trim();
  expect(link).toMatch(/\/kassir\/[A-Za-z0-9_-]{20,}$/);
  const path = new URL(link).pathname;

  // Kassir o'z telefonida (alohida brauzer konteksti)
  const cashierContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const cashier = await cashierContext.newPage();
  await cashier.goto(path, { waitUntil: "networkidle" });
  await expect(cashier.getByText("Bodom Choyxonasi sizni talabaPass kassiri")).toBeVisible();
  await cashier.locator("#inv-first").fill("Sinov");
  await cashier.locator("#inv-last").fill("Kassir");
  await cashier.locator("#inv-phone").fill(local(CASHIER));
  await cashier.getByRole("button", { name: "SMS kod olish" }).click();
  await expect(codeBox(cashier)).toBeEnabled();
  await enterCode(cashier, FIXED_CODE);
  await expect(cashier).toHaveURL("/biznes/skaner");
  await expect(cashier.getByTestId("cashier-business")).toHaveText("Bodom Choyxonasi");
  // Kassir biznes kabinetiga kira olmaydi
  await cashier.goto("/biznes/profil");
  await expect(cashier).toHaveURL("/biznes/skaner");

  // Havola ikkinchi marta ishlamaydi
  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto(path);
  await expect(second.getByTestId("invite-invalid")).toBeVisible();
  await other.close();

  // Egasi o'chiradi
  await page.reload({ waitUntil: "networkidle" });
  const row = page.getByTestId("cashier-row").locator("visible=true").filter({ hasText: "Sinov Kassir" });
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: /O'chirish/ }).click();
  await expect(row).toHaveCount(0);

  // Kassirning ochiq sessiyasi darhol ishlamay qoladi
  await cashier.reload();
  await expect(cashier).toHaveURL("/kirish");
  // (sessiyalar bazadan o'chirilgani — cashiers.itest.ts da)

  await cashierContext.close();
});

test("o'chirilgan kassir qayta kira olmaydi", async ({ page }) => {
  await withDb(async (db) => {
    const { rows } = await db.query(`INSERT INTO "User" (id, phone, role, "firstName", "lastName", "updatedAt") VALUES ('e2e_removed_cashier', $1, 'CASHIER', 'Sobiq', 'Kassir', now()) RETURNING id`, [CASHIER]);
    await db.query(
      `INSERT INTO "BusinessMember" (id, "businessId", "userId", role, active) SELECT 'e2e_removed_m', id, $1, 'CASHIER', false FROM "Business" WHERE name = 'Bodom Choyxonasi'`,
      [rows[0].id],
    );
  });
  await page.goto("/kirish", { waitUntil: "networkidle" });
  await page.locator("#login-phone").fill(local(CASHIER));
  await page.getByRole("button", { name: "SMS kod olish" }).click();
  await expect(codeBox(page)).toBeEnabled();
  await enterCode(page, FIXED_CODE);
  await expect(page.getByText("hech qaysi biznesga kassir sifatida biriktirilmagansiz")).toBeVisible();
  expect(page.url()).toContain("/kirish");
});
