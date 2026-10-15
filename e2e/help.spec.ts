import { expect, test } from "@playwright/test";
import { seedPhones, signIn, type SeedPhones } from "./helpers";

let phones: SeedPhones;
test.beforeAll(async () => {
  phones = await seedPhones();
});

test("talaba: profildagi 'Yordam markazi' ilova ichidagi /yordam ga olib boradi (landing'ga emas)", async ({ page }) => {
  await signIn(page, phones.student);
  await page.goto("/profil", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Yordam markazi" }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/yordam$/);
  await expect(page.getByRole("heading", { name: "Yordam markazi" }).locator("visible=true")).toBeVisible();

  // Savollar ochiladi
  const q = page.getByText("Kupon qanday ishlaydi?").locator("visible=true");
  await q.click();
  await expect(page.getByText("Kupon 10 daqiqa amal qiladi").locator("visible=true")).toBeVisible();

  // Aloqa: Telegram va telefon (.env.development dagi sinov qiymatlari)
  await expect(page.getByRole("link", { name: /Telegram orqali yozish/ }).locator("visible=true")).toHaveAttribute("href", "https://t.me/talabapass_sinov");
  await expect(page.getByRole("link", { name: /Qo'ng'iroq qilish/ }).locator("visible=true")).toHaveAttribute("href", "tel:+998901234567");
});
