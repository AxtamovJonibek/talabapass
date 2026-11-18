import { expect, test } from "@playwright/test";
import { clearOtp, codeBox, local, registerPhone, requestCode } from "./helpers";

// "Orqaga": ko'p qadamli formalarda ← tugmasi va telefonning/brauzerning "orqaga"i oldingi qadamga qaytaradi;
// 1-qadamda — bosh sahifaga.
test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(120_000);

test("ro'yxat: kod qadamidan brauzer 'orqaga' raqam qadamiga, ← bosh sahifaga", async ({ page }) => {
  const fresh = "+998905550979";
  await requestCode(page, fresh);
  await expect(codeBox(page)).toBeVisible();
  await page.goBack();
  await expect(page.locator("#register-phone")).toBeVisible();
  await expect(page).toHaveURL(/\/kirish/);

  // ← tugmasi: kod qadami → raqam, so'ng bosh sahifa
  await page.locator("#register-phone").fill(local(fresh));
  await page.getByRole("button", { name: "SMS kod olish" }).click();
  await expect(codeBox(page)).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page.locator("#register-phone")).toBeVisible();
  await page.getByRole("button", { name: "Orqaga" }).click();
  await expect(page).toHaveURL("/uz", { timeout: 60_000 });
  await clearOtp(fresh);
});

test("kirish → \"Parolni unutdim\": brauzer 'orqaga' kirish formasiga qaytaradi", async ({ page }) => {
  await page.goto("/uz/kirish", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Parolni unutdim" }).click();
  await expect(page.locator("#forgot-identifier")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#login-identifier")).toBeVisible();
});

test("biznes ro'yxati: 2-qadamdan ← va brauzer 'orqaga' 1-qadamga, 1-qadamda ← bosh sahifaga", async ({ page }) => {
  await registerPhone(page, "+998905550978", "Biznes");
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
  await expect(page).toHaveURL("/uz", { timeout: 60_000 });
});
