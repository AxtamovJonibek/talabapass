import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * Capacitor ilovasidagi oqim (design/app-flow). Ilova `CapacitorCustomPlatform` bilan taqlid qilinadi:
 * `Capacitor.isNativePlatform()` true, plaginlar web ko'rinishida (Preferences — localStorage).
 */
async function asNativeApp(context: BrowserContext) {
  await context.addInitScript(() => {
    (window as unknown as { CapacitorCustomPlatform: unknown }).CapacitorCustomPlatform = { name: "android", plugins: {} };
  });
}

test.describe("ilova: birinchi ochilish", () => {
  test("karusel bir marta ko'rinadi, keyin kirish ochiladi", async ({ page, context }) => {
    await asNativeApp(context);
    await page.goto("/uz");
    // Landing ilovada ko'rsatilmaydi
    await expect(page).toHaveURL(/\/uz\/ilova/);
    await expect(page.getByRole("heading", { name: /arzonroq/ })).toBeVisible();

    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page.getByRole("heading", { name: /joylar/ })).toBeInViewport();
    await page.getByRole("button", { name: "Boshlash" }).click();

    await expect(page).toHaveURL(/\/uz\/kirish$/);
    await expect(page.getByRole("heading", { name: /Boshla/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kod yuborish" })).toBeVisible();

    // Ikkinchi ochilish — karuselsiz
    await page.goto("/uz/ilova");
    await expect(page).toHaveURL(/\/uz\/kirish$/);
  });

  test("\"Biznes egasimisiz?\" — Biz1, Biz2, keyin biznes kirishi", async ({ page, context }) => {
    await asNativeApp(context);
    await page.goto("/uz/ilova");
    await page.getByRole("link", { name: "O'tkazib yuborish" }).click();
    await expect(page).toHaveURL(/\/uz\/kirish$/);

    await page.getByRole("link", { name: /Biznes egasimisiz/ }).click();
    await expect(page.getByRole("heading", { name: /mijozlar/ })).toBeVisible();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.getByRole("button", { name: "Biznes sifatida boshlash" }).click();

    await expect(page).toHaveURL(/\/uz\/kirish\?rol=biznes$/);
    await expect(page.getByText("Biznes hisobi uchun telefon raqamingizni kiriting.")).toBeVisible();
  });

  test("brauzerda /ilova sayt bosh sahifasiga qaytaradi, /kirish o'zgarmagan", async ({ page }) => {
    await page.goto("/uz/ilova");
    await expect(page).toHaveURL(/\/uz$/);
    await page.goto("/uz/kirish");
    await expect(page.getByRole("button", { name: "SMS kod olish" })).toBeVisible();
  });
});
