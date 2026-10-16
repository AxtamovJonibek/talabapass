import { expect, test } from "@playwright/test";
import { codeBox, local, requestCode, seedPhones } from "./helpers";

// "Orqaga": ko'p qadamli formalarda ← tugmasi va telefonning/brauzerning "orqaga"i oldingi qadamga qaytaradi;
// 1-qadamda — bosh sahifaga.
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(120_000);

test("kirish: kod qadamidan brauzer 'orqaga' raqam qadamiga, ← bosh sahifaga", async ({ page }) => {
  const { student } = await seedPhones();
  await requestCode(page, student);
  await expect(codeBox(page)).toBeVisible();
  await page.goBack();
  await expect(page.locator("#login-phone")).toBeVisible();
  await expect(page).toHaveURL(/\/kirish/);

  // ← tugmasi: kod qadami → raqam, so'ng bosh sahifa
  await page.locator("#login-phone").fill(local(student));
  await page.getByRole("button", { name: "SMS kod olish" }).click();
  await expect(codeBox(page)).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page.locator("#login-phone")).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page).toHaveURL("/", { timeout: 60_000 });
});

test("biznes ro'yxati: 2-qadamdan ← va brauzer 'orqaga' 1-qadamga, 1-qadamda ← bosh sahifaga", async ({ page }) => {
  await page.goto("/biznes/royxat", { waitUntil: "networkidle" });
  await page.locator("#b1-name").fill("Sinov Kafesi");
  await page.locator("#b1-address").fill("Chilonzor, Bunyodkor ko'chasi 12");
  await page.locator("#b1-hours").fill("09:00 – 22:00");
  await page.locator("#b1-tin").fill("309100913");
  await page.getByRole("button", { name: "Kafe / restoran" }).locator("visible=true").click();
  await page.getByRole("button", { name: /Keyingi/ }).locator("visible=true").click();
  await expect(page.locator("#b1-contact")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#b1-name")).toBeVisible();
  await page.getByRole("button", { name: /Keyingi/ }).locator("visible=true").click();
  await expect(page.locator("#b1-contact")).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).locator("visible=true").first().click();
  await expect(page.locator("#b1-name")).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).locator("visible=true").first().click();
  await expect(page).toHaveURL("/", { timeout: 60_000 });
});
