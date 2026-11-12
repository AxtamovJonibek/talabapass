import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn } from "./helpers";

// Joy tanlovi (T4 / WT2 sarlavhasidagi tugma) va "Yo'l ko'rsatish" oynasi (T5 / WT3, xarita) — umumiy BottomSheet.
test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const trigger = (page: Page) => page.locator('button[aria-label^="Joy:"]').locator("visible=true").first();
const sheet = (page: Page) => page.getByTestId("bottom-sheet");

test("telefon: qidiruv, tanlash, cookie o'chsa ham tiklanadi; Esc va pastga surish yopadi", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, (await seedPhones()).student);
  await page.goto("/chegirmalar");

  await trigger(page).click();
  const dialog = sheet(page).getByRole("dialog", { name: "Joylashuvni tanlang" });
  await expect(dialog).toBeVisible();
  // Telefonda klaviatura o'zi chiqmaydi
  await expect(dialog.getByRole("combobox")).not.toBeFocused();
  await expect(dialog.getByText("Toshkent tumanlari")).toBeVisible();
  await expect(dialog.getByText("Viloyatlar")).toBeVisible();

  await dialog.getByRole("combobox").fill("samar");
  await expect(dialog.getByRole("option")).toHaveCount(2); // "Mening joylashuvim" + Samarqand
  await dialog.getByRole("option", { name: "Samarqand" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(trigger(page)).toHaveAttribute("aria-label", "Joy: Samarqand");
  expect(await page.evaluate(() => localStorage.getItem("tp:joy"))).toBe("r:samarqand");

  // Cookie yo'qolsa — shu brauzerda saqlangani tiklanadi
  await context.clearCookies({ name: "tp_loc" });
  await page.reload();
  await expect(trigger(page)).toHaveAttribute("aria-label", "Joy: Samarqand");

  // Tanlangani belgili; Esc yopadi, fokus tugmaga qaytadi
  await trigger(page).click();
  await expect(dialog.getByRole("option", { name: "Samarqand" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();

  // Pastga surib yopish
  await trigger(page).click();
  await page.waitForTimeout(500); // ko'tarilish animatsiyasi tugasin — tutqich joyida bo'lsin
  const handle = sheet(page).locator(".cursor-grab");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  for (let y = 20; y <= 240; y += 20) await page.mouse.move(box.x + box.width / 2, box.y + 10 + y);
  await page.mouse.up();
  await expect(sheet(page)).toHaveCount(0);

  // Toshkent tumaniga qaytarish (boshqa testlar masofaga tayanishi mumkin)
  await trigger(page).click();
  await dialog.getByRole("option", { name: "Chilonzor" }).click();
  await expect(trigger(page)).toHaveAttribute("aria-label", "Joy: Chilonzor");
});

test("telefon: geolokatsiyaga ruxsat yo'q — tushunarli xabar va qayta urinish", async ({ page }) => {
  await signIn(page, (await seedPhones()).student);
  await page.goto("/chegirmalar");
  await trigger(page).click();
  await sheet(page).getByRole("option", { name: /Mening joylashuvim/ }).click();
  await expect(sheet(page).getByText("Ruxsat berilmadi").first()).toBeVisible();
  await expect(sheet(page).getByRole("option", { name: /Qayta urinish/ })).toBeVisible();
});

test("kompyuter: klaviatura bilan tanlash, fokus oyna ichida qoladi", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, (await seedPhones()).student);
  await page.goto("/chegirmalar");
  await trigger(page).click();
  const input = sheet(page).getByRole("combobox");
  await expect(input).toBeFocused();
  await input.fill("yunus");
  await page.keyboard.press("Enter");
  await expect(trigger(page)).toHaveAttribute("aria-label", "Joy: Yunusobod");

  await trigger(page).click();
  for (let i = 0; i < 30; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]")))).toBe(true);
  await page.keyboard.press("Escape");
  await trigger(page).click();
  await sheet(page).getByRole("option", { name: "Chilonzor" }).click();
  await expect(trigger(page)).toHaveAttribute("aria-label", "Joy: Chilonzor");
});

test("yo'l ko'rsatish: rasmiy havolalar, oxirgi ishlatilgani tepada, manzil nusxalanadi", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, (await seedPhones()).student);
  await page.goto("/chegirmalar");
  // Masofa tanlangan joydan hisoblanadi
  await trigger(page).click();
  await sheet(page).getByRole("option", { name: "Chilonzor" }).click();
  await expect(trigger(page)).toHaveAttribute("aria-label", "Joy: Chilonzor");
  await page.getByRole("link", { name: /Kapuchino 300 ml/ }).locator("visible=true").first().click();
  const route = page.getByRole("button", { name: "Yo'l", exact: true }).locator("visible=true");
  await route.click();

  const dialog = sheet(page).getByRole("dialog", { name: "Qahva Bekati" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("to'g'ri chiziq bo'yicha")).toBeVisible();
  const links = dialog.locator("a[data-provider]");
  await expect(links).toHaveCount(4);
  const hrefs = Object.fromEntries(await links.evaluateAll((els) => els.map((a) => [(a as HTMLElement).dataset.provider, (a as HTMLAnchorElement).href])));
  expect(hrefs.yandex).toMatch(/^https:\/\/yandex\.uz\/maps\/\?rtext=~41\.\d+,69\.\d+&rtt=auto$/);
  expect(hrefs.google).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=41\.\d+%2C69\.\d+$/);
  expect(hrefs.dgis).toMatch(/^https:\/\/2gis\.uz\/routeSearch\/rsType\/car\/to\/69\.\d+,41\.\d+$/);
  expect(hrefs.yandexGo).toMatch(/^https:\/\/3\.redirect\.appmetrica\.yandex\.com\/route\?end-lat=41\.\d+&end-lon=69\.\d+&ref=talabapass&appmetrica_tracking_id=\d+$/);

  // Tashqi sahifa ochilmasin — faqat tanlov eslab qolinadi
  await context.route(/2gis\.uz/, (r) => r.abort());
  const popup = context.waitForEvent("page");
  await dialog.locator('a[data-provider="dgis"]').click();
  await (await popup).close();
  await expect(sheet(page)).toHaveCount(0);

  await route.click();
  await expect(links.first()).toHaveAttribute("data-provider", "dgis");
  await expect(links.first()).toContainText("Oxirgi ishlatilgan");

  await dialog.getByRole("button", { name: "Manzilni nusxalash" }).click();
  await expect(page.getByTestId("toast")).toHaveText(/Nusxalandi/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Qahva Bekati");
});
