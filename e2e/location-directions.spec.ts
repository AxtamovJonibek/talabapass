import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb } from "./helpers";

// Joy tanlovi (T4 / WT2 sarlavhasidagi tugma) va "Qanday boraman?" oynasi (T5 / WT3, xarita) — umumiy BottomSheet.
test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const trigger = (page: Page) => page.locator('button[aria-label^="Joy:"]').locator("visible=true").first();
const sheet = (page: Page) => page.getByTestId("bottom-sheet");

test("telefon: qidiruv, tanlash, cookie o'chsa ham tiklanadi; Esc va pastga surish yopadi", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, (await seedPhones()).student);
  await page.goto("/uz/chegirmalar");

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
  await page.goto("/uz/chegirmalar");
  await trigger(page).click();
  await sheet(page).getByRole("option", { name: /Mening joylashuvim/ }).click();
  await expect(sheet(page).getByText("Ruxsat berilmadi").first()).toBeVisible();
  await expect(sheet(page).getByRole("option", { name: /Qayta urinish/ })).toBeVisible();
});

test("kompyuter: klaviatura bilan tanlash, fokus oyna ichida qoladi", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, (await seedPhones()).student);
  await page.goto("/uz/chegirmalar");
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

test("qanday boraman: uch tur uchun Yandex va Google havolalari, 2GIS yo'q, mo'ljal, oxirgi ishlatilgani tepada, nusxalash", async ({ page, context }) => {
  const LANDMARK = "Chilonzor metrosidan 5 daqiqa, Mevazor yonida";
  const before = await withDb(async (db) => (await db.query<{ landmark: string | null }>(`SELECT landmark FROM "Business" WHERE name = 'Qahva Bekati'`)).rows[0]!.landmark);
  await withDb((db) => db.query(`UPDATE "Business" SET landmark = $1 WHERE name = 'Qahva Bekati'`, [LANDMARK]));
  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page, (await seedPhones()).student);
    await page.goto("/uz/chegirmalar");
    // Masofa tanlangan joydan hisoblanadi
    await trigger(page).click();
    await sheet(page).getByRole("option", { name: "Chilonzor" }).click();
    await expect(trigger(page)).toHaveAttribute("aria-label", "Joy: Chilonzor");
    await page.evaluate(() => localStorage.removeItem("tp:yonalish-turi"));
    await page.getByRole("link", { name: /Kapuchino 300 ml/ }).locator("visible=true").first().click();
    // Mo'ljal manzil ostida
    await expect(page.getByTestId("deal-landmark").locator("visible=true")).toHaveText(`Mo'ljal: ${LANDMARK}`);
    const go = page.getByTestId("directions-open").locator("visible=true");
    await expect(go).toHaveText(/^Borish · \d+(\.\d)? (km|m)$/);
    await go.click();

    const dialog = sheet(page).getByRole("dialog", { name: "Qanday boraman?" });
    await expect(dialog).toBeVisible();
    const place = dialog.getByTestId("directions-place");
    await expect(place).toContainText("Qahva Bekati");
    await expect(place).toContainText(/\d+(\.\d)? (km|m) uzoqlikda/);
    await expect(place).toContainText(`Mo'ljal: ${LANDMARK}`);
    await expect(dialog).not.toContainText("to'g'ri chiziq");
    await expect(dialog).not.toContainText("Ilovada");
    await expect(dialog).not.toContainText("2GIS");

    const links = dialog.locator("a[data-provider]");
    await expect(links).toHaveCount(3);
    const hrefs = async () => Object.fromEntries(await links.evaluateAll((els) => els.map((a) => [(a as HTMLElement).dataset.provider, (a as HTMLAnchorElement).href])));
    // Chilonzordan 1 km dan uzoq — standart: jamoat transporti
    await expect(dialog.getByRole("radio", { name: "Jamoat transporti" })).toHaveAttribute("aria-checked", "true");
    let h = await hrefs();
    expect(Object.keys(h)).toEqual(["yandex", "google", "yandexGo"]);
    expect(h.yandex).toMatch(/^https:\/\/yandex\.uz\/maps\/\?rtext=~41\.\d+,69\.\d+&rtt=mt$/);
    expect(h.google).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=41\.\d+%2C69\.\d+&travelmode=transit$/);
    expect(h.yandexGo).toMatch(/^https:\/\/3\.redirect\.appmetrica\.yandex\.com\/route\?end-lat=41\.\d+&end-lon=69\.\d+&ref=talabapass&appmetrica_tracking_id=\d+$/);
    await dialog.getByRole("radio", { name: "Mashinada" }).click();
    h = await hrefs();
    expect([h.yandex.endsWith("&rtt=auto"), h.google.endsWith("&travelmode=driving")]).toEqual([true, true]);
    await dialog.getByRole("radio", { name: "Piyoda" }).click();
    h = await hrefs();
    expect([h.yandex.endsWith("&rtt=pd"), h.google.endsWith("&travelmode=walking")]).toEqual([true, true]);

    // Tashqi sahifa ochilmasin — faqat tanlov eslab qolinadi
    await context.route(/google\.com/, (r) => r.abort());
    const popup = context.waitForEvent("page");
    await dialog.locator('a[data-provider="google"]').click();
    await (await popup).close();
    await expect(sheet(page)).toHaveCount(0);

    await go.click();
    await expect(links.first()).toHaveAttribute("data-provider", "google");
    await expect(links.first()).toContainText("Oxirgi ishlatilgan");
    // Oxirgi tur ham eslab qolingan
    await expect(dialog.getByRole("radio", { name: "Piyoda" })).toHaveAttribute("aria-checked", "true");

    await dialog.getByRole("button", { name: "Manzilni nusxalash" }).click();
    await expect(page.getByTestId("toast")).toHaveText(/Nusxalandi/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Qahva Bekati");
  } finally {
    await withDb((db) => db.query(`UPDATE "Business" SET landmark = $1 WHERE name = 'Qahva Bekati'`, [before]));
  }
});
