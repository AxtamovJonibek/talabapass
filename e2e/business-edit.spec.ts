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
  await page.goto("/uz/biznes/profil");
  await page.getByRole("link", { name: "Tahrirlash" }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/biznes\/profil\/tahrir$/);

  // Ish vaqti tanlovdan: "Boshqa vaqt" → 08:00–22:00; keyin kunlar bo'yicha — yakshanba dam olish
  const form = page.locator("form").locator("visible=true").first();
  await form.getByRole("button", { name: "Boshqa vaqt" }).click();
  await form.locator("select[id$='hours-from']").selectOption(String(8 * 60));
  await form.locator("select[id$='hours-to']").selectOption(String(22 * 60));
  await expect(form.getByText("Har kuni · 08:00–22:00")).toBeVisible();
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByTestId("business-saved").locator("visible=true")).toHaveText("Saqlandi");
  expect(await business(phones.owner)).toMatchObject({ workingHours: "Har kuni · 08:00–22:00", status: before.status });

  await form.getByRole("switch", { name: "Har kuni bir xil" }).click();
  await form.getByRole("switch", { name: "Yakshanba" }).click();
  await expect(form.getByText("Du–Sh 08:00–22:00")).toBeVisible();
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  // "Saqlandi" yozuvi oldingi saqlashdan qolgan — bazani kutamiz
  await expect.poll(async () => (await business(phones.owner)).workingHours).toBe("Du–Sh 08:00–22:00");
  // Qayta ochilganda jadval tiklanadi
  await page.reload();
  await expect(page.getByText("Du–Sh 08:00–22:00").locator("visible=true")).toBeVisible();

  await page.locator("#bp-name").fill("A");
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByText("Biznes nomini kiriting (2–60 belgi).").locator("visible=true")).toBeVisible();
  expect((await business(phones.owner)).name).toBe(before.name);

  await page.locator("#bp-name").fill(`${before.name} (yangi)`);
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByTestId("business-saved").locator("visible=true")).toContainText("qayta tekshiruvga");
  expect(await business(phones.owner)).toMatchObject({ status: "PENDING", name: `${before.name} (yangi)` });
});
