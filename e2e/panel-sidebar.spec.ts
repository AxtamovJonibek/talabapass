import { expect, test, type Page } from "@playwright/test";
import { enterAdminPassword, seedPhones, signIn } from "./helpers";

// Biznes va admin paneli (desktop): qora yon panel qotgan — uzun sahifa oxirigacha skroll qilinganda ham panel ekranda,
// "Hisobdan chiqish" ko'rinadi; skroll faqat o'ng tomondagi kontentda. Telefonda (360px) pastki navigatsiya o'zgarmagan.
test.setTimeout(120_000);

async function scrollToBottom(page: Page) {
  const long = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  if (long) await page.waitForFunction(() => window.scrollY > 0);
}

async function expectPinned(page: Page) {
  const viewport = page.viewportSize()!;
  const sidebar = page.getByTestId("sidebar");
  const box = (await sidebar.boundingBox())!;
  expect(Math.round(box.y)).toBe(0);
  expect(Math.round(box.height)).toBe(viewport.height);
  const logout = page.getByRole("button", { name: "Hisobdan chiqish" }).locator("visible=true");
  await expect(logout).toBeInViewport({ ratio: 1 });
  const footer = (await page.getByTestId("sidebar-footer").boundingBox())!;
  expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height);
}

test.describe("1440×900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("biznes: uzun sahifada yon panel qotgan, faqat kontent skroll bo'ladi", async ({ page }) => {
    await signIn(page, (await seedPhones()).owner);
    await page.goto("/biznes/sozlamalar");
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height).toBeGreaterThan(900 * 1.5);
    await expectPinned(page);
    await scrollToBottom(page);
    await expectPinned(page);
    // Kontent haqiqatan surildi: sarlavha ekrandan chiqib ketdi
    await expect(page.getByRole("heading", { level: 1 }).first()).not.toBeInViewport();
  });

  test("admin: yon panel qotgan, chiqish tugmasi pastda doim ko'rinadi", async ({ page }) => {
    await signIn(page, (await seedPhones()).admin);
    await page.goto("/admin");
    // Parolsiz admin /kirish/admin ga yo'naltiriladi (yo'naltirish sahifa yuklangandan keyin ham bo'lishi mumkin)
    const password = page.locator("#admin-password");
    await Promise.race([page.getByTestId("sidebar").waitFor(), password.waitFor()]);
    if (await password.isVisible()) {
      await enterAdminPassword(page);
      await page.waitForURL((url) => url.pathname === "/admin");
    }
    await page.getByTestId("sidebar").waitFor();
    await expectPinned(page);
    await scrollToBottom(page);
    await expectPinned(page);
  });
});

test("360px: biznes telefonida pastki navigatsiya joyida, yon panel qotmagan", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, (await seedPhones()).owner);
  await page.goto("/biznes/buyurtmalar");
  await expect(page.getByTestId("sidebar").locator("visible=true")).toHaveCount(0);
  const nav = page.getByRole("navigation").filter({ hasText: "Buyurtmalar" }).locator("visible=true").last();
  await expect(nav).toBeInViewport();
  const box = (await nav.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(780);
  // Gorizontal skroll yo'q
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
