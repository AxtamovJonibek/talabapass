import { expect, test } from "@playwright/test";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

// B5 — biznes ma'lumotlarini tahrirlash: ish vaqti tekshiruvsiz, nom/manzil — qayta tekshiruv
let phones: SeedPhones;
test.setTimeout(90_000);
type Row = { id: string; name: string; address: string; workingHours: string; description: string | null; status: string };
const business = (phone: string) =>
  withDb(async (db) => (await db.query<Row>(`SELECT b.id, b.name, b.address, b."workingHours", b.description, b.status FROM "Business" b JOIN "User" u ON u.id = b."ownerId" WHERE u.phone = $1 ORDER BY b."createdAt" LIMIT 1`, [phone])).rows[0]!);
let before: Row;

test.beforeAll(async () => {
  phones = await seedPhones();
  before = await business(phones.owner);
});
test.afterAll(async () => {
  await withDb((db) =>
    db.query(`UPDATE "Business" SET name = $2, address = $3, "workingHours" = $4, description = $5, status = $6::"BusinessStatus" WHERE id = $1`, [before.id, before.name, before.address, before.workingHours, before.description, before.status]),
  );
});

test("egasi ish vaqtini o'zgartiradi (holat qoladi), nomni o'zgartirsa qayta tekshiruvga tushadi", async ({ page }) => {
  await signIn(page, phones.owner);
  await page.goto("/biznes/profil");
  await page.getByRole("link", { name: "Tahrirlash" }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/biznes\/profil\/tahrir$/);

  await page.locator("#bp-hours").fill("08:00 – 22:00");
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByTestId("business-saved").locator("visible=true")).toHaveText("Saqlandi");
  expect(await business(phones.owner)).toMatchObject({ workingHours: "08:00 – 22:00", status: before.status });

  await page.locator("#bp-name").fill("A");
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByText("Biznes nomini kiriting (2–60 belgi).").locator("visible=true")).toBeVisible();
  expect((await business(phones.owner)).name).toBe(before.name);

  await page.locator("#bp-name").fill(`${before.name} (yangi)`);
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByTestId("business-saved").locator("visible=true")).toContainText("qayta tekshiruvga");
  expect(await business(phones.owner)).toMatchObject({ status: "PENDING", name: `${before.name} (yangi)` });
});
