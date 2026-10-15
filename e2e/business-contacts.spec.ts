import { expect, test } from "@playwright/test";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

/** Biznes aloqasi (telefon, Telegram, Instagram): egasi kiritadi → talaba chegirma sahifasida ko'radi. */
let phones: SeedPhones;
let businessId: string;
test.setTimeout(120_000);

test.beforeAll(async () => {
  phones = await seedPhones();
  businessId = await withDb(async (db) => (await db.query<{ id: string }>(`SELECT b.id FROM "Business" b JOIN "User" u ON u.id = b."ownerId" WHERE u.phone = $1 ORDER BY b."createdAt" LIMIT 1`, [phones.owner])).rows[0]!.id);
});
test.afterAll(async () => {
  await withDb((db) => db.query(`UPDATE "Business" SET "publicPhone" = NULL, telegram = NULL, instagram = NULL WHERE id = $1`, [businessId]));
});

test("egasi aloqani kiritadi (noto'g'ri qiymat rad etiladi), talaba chegirma sahifasida ko'radi", async ({ page, browser }) => {
  await signIn(page, phones.owner);
  await page.goto("/biznes/profil/tahrir", { waitUntil: "networkidle" });
  const save = () => page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();

  await page.locator("#bp-phone").fill("+7 900 123 45 67");
  await page.locator("#bp-telegram").fill("ab");
  await save();
  await expect(page.getByText("Telefonni +998 bilan, 9 raqam qilib kiriting.").locator("visible=true")).toBeVisible();
  await expect(page.getByText("Telegram nomi 5–32 belgi").locator("visible=true")).toBeVisible();

  await page.locator("#bp-phone").fill("90 123 45 67");
  await page.locator("#bp-telegram").fill("https://t.me/bodom_choyxona");
  await page.locator("#bp-instagram").fill("@bodom.choyxona");
  await save();
  await expect(page.getByTestId("business-saved").locator("visible=true")).toBeVisible();
  const saved = await withDb(async (db) => (await db.query(`SELECT "publicPhone", telegram, instagram, status FROM "Business" WHERE id = $1`, [businessId])).rows[0]);
  expect(saved).toMatchObject({ publicPhone: "+998901234567", telegram: "bodom_choyxona", instagram: "bodom.choyxona" });

  // Talaba: shu biznesning chegirmasi
  const discountId = await withDb(async (db) => (await db.query<{ id: string }>(`SELECT id FROM "Discount" WHERE "businessId" = $1 AND status = 'ACTIVE' ORDER BY "createdAt" LIMIT 1`, [businessId])).rows[0]?.id);
  test.skip(!discountId || saved.status !== "APPROVED", "Bu biznesda faol chegirma yo'q yoki biznes tasdiqlanmagan");
  const student = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const studentPage = await student.newPage();
  await signIn(studentPage, phones.student);
  await studentPage.goto(`/chegirmalar/${discountId}`, { waitUntil: "networkidle" });
  const call = studentPage.getByRole("link", { name: /Qo'ng'iroq qilish/ }).locator("visible=true");
  await expect(call).toHaveAttribute("href", "tel:+998901234567");
  await expect(studentPage.getByRole("link", { name: "Telegram" }).locator("visible=true")).toHaveAttribute("href", "https://t.me/bodom_choyxona");
  await expect(studentPage.getByRole("link", { name: "Instagram" }).locator("visible=true")).toHaveAttribute("href", "https://instagram.com/bodom.choyxona");
  await student.close();

  // Tozalash: bo'sh maydonlar — aloqa ko'rinmaydi
  await page.locator("#bp-phone").fill("");
  await page.locator("#bp-telegram").fill("");
  await page.locator("#bp-instagram").fill("");
  await save();
  await expect
    .poll(() => withDb(async (db) => (await db.query(`SELECT "publicPhone", telegram, instagram FROM "Business" WHERE id = $1`, [businessId])).rows[0]))
    .toEqual({ publicPhone: null, telegram: null, instagram: null });
});
