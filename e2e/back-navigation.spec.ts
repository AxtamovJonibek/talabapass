import { expect, test } from "@playwright/test";
import { codeBox, local, reachRegistrationDetails, requestCode, seedPhones } from "./helpers";

// "Orqaga": ko'p qadamli formalarda ← tugmasi va telefonning/brauzerning "orqaga"i oldingi qadamga qaytaradi;
// 1-qadamda — bosh sahifaga.
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(120_000);

test("kirish: kod qadamidan brauzer 'orqaga' raqam qadamiga, ← kirishga, so'ng bosh sahifaga", async ({ page }) => {
  const { student } = await seedPhones();
  await requestCode(page, student);
  await expect(codeBox(page)).toBeVisible();
  await page.goBack();
  await expect(page.locator("#login-phone")).toBeVisible();
  await expect(page).toHaveURL(/\/kirish/);

  // ← tugmasi: kod qadami → raqam → kirish → bosh sahifa
  await page.locator("#login-phone").fill(local(student));
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await expect(codeBox(page)).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page.locator("#login-phone")).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page.locator("#signin-identifier")).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page).toHaveURL("/uz", { timeout: 60_000 });
});

test("biznes ro'yxati: ma'lumotlardan ← parolga, brauzer 'orqaga' oldingi qadamga, 1-qadamda ← bosh sahifaga", async ({ page }) => {
  await reachRegistrationDetails(page, "+998905550995", "/uz/biznes/royxat");
  await expect(page.locator("#biz-name")).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page.locator("#auth-password")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#login-phone")).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page.getByRole("button", { name: "Telefon raqam bilan" })).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page).toHaveURL("/uz", { timeout: 60_000 });
});
