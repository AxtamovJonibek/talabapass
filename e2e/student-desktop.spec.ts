import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb } from "./helpers";

// Talaba desktop: profildagi "Orqaga", oflayn "Qayta urinish", tafsilot bir ekranga sig'adi, karta hover/belgi,
// karusel va filtr qatori, saralash ro'yxati (klaviatura), tugmalar (bosilish, fokus, spinner).
test.setTimeout(120_000);

async function discountId(title: string): Promise<string> {
  const { rows } = await withDb((db) => db.query<{ id: string }>(`SELECT id FROM "Discount" WHERE title = $1`, [title]));
  return rows[0]!.id;
}

const visible = (page: Page, role: "button" | "link", name: string | RegExp) => page.getByRole(role, { name }).locator("visible=true");

test.describe("1440", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("profil: 'Orqaga' lentaga, ichki sahifalardan profilga qaytaradi", async ({ page }) => {
    const { student } = await seedPhones();
    await signIn(page, student);
    await page.goto("/profil");
    await visible(page, "link", "Orqaga").click();
    await expect(page).toHaveURL("/chegirmalar");

    await page.goto("/profil/guvohnoma");
    await visible(page, "link", "Orqaga").click();
    await expect(page).toHaveURL("/profil");
  });

  test("lenta: karusel tugmasiz, filtr chiplari karuseldan pastda, saralash klaviatura bilan", async ({ page }) => {
    const { student } = await seedPhones();
    await signIn(page, student);
    await expect(page).toHaveURL("/chegirmalar");

    await expect(page.getByRole("button", { name: /kategoriyalar/i })).toHaveCount(0);
    const group = page.getByRole("group", { name: "Kategoriyalar" }).locator("visible=true");
    const mask = await group.evaluate((e) => getComputedStyle(e).maskImage);
    expect(mask).toContain("linear-gradient");

    const carousel = await group.boundingBox();
    const live = await visible(page, "button", "Hozir ochiq").boundingBox();
    const map = await visible(page, "button", "Xarita").boundingBox();
    expect(live!.y).toBeGreaterThan(carousel!.y + carousel!.height - 1);
    // bitta qator: 44px boshqaruvlar bir chiziqda
    expect(map!.y + map!.height / 2).toBeCloseTo(live!.y + live!.height / 2, 0);
    expect(live!.height).toBe(44);
    // yoqilganda ko'k fon
    await visible(page, "button", "Hozir ochiq").click();
    await expect(visible(page, "button", "Hozir ochiq")).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/ochiq=1/);

    // "Xarita" — kartalar o'rnida xarita, URL'da saqlanadi; "Ro'yxat" — kartalar qaytadi
    await visible(page, "button", "Xarita").click();
    await expect(page).toHaveURL(/korinish=xarita/);
    await expect(page.getByRole("region", { name: "Xaritada" }).locator("visible=true")).toBeVisible();
    await expect(page.locator("a:has(h2)").locator("visible=true")).toHaveCount(0);
    await visible(page, "button", "Ro'yxat").click();
    await expect(page).not.toHaveURL(/korinish/);
    await expect(page.locator("a:has(h2)").locator("visible=true").first()).toBeVisible();

    // saralash: ochiladi, ↓ + Enter tanlaydi, Esc yopadi
    const sort = page.locator("#wt2-sort");
    await sort.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("listbox").getByRole("option", { selected: true })).toHaveCount(1);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page).toHaveURL(/saralash=/);
    await sort.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("karta: hover'da chegara yo'q, 4px ko'tariladi; foiz belgisi yumaloq va qiya", async ({ page }) => {
    const { student } = await seedPhones();
    await signIn(page, student);
    const card = page.locator("a:has(h2)").locator("visible=true").first();
    await card.hover();
    await page.waitForTimeout(400);
    const look = await card.evaluate((e) => {
      const c = getComputedStyle(e);
      return { shadow: c.boxShadow, translate: c.translate, border: c.borderTopWidth };
    });
    expect(look.border).toBe("0px");
    expect(look.shadow).not.toContain("1.5px");
    expect(look.translate).toContain("-4px");
    // Tailwind v4: qiyshaytirish alohida `rotate` xususiyatida
    const badge = await card.locator("span.-rotate-3").evaluate((e) => {
      const c = getComputedStyle(e);
      return { rotate: c.rotate, radius: c.borderTopLeftRadius };
    });
    expect(badge.radius).toBe("11px");
    expect(badge.rotate).toBe("-3deg");
  });

  test("tugmalar: bosilganda kichrayadi, klaviatura fokusi ko'k halqa", async ({ page }) => {
    const { student } = await seedPhones();
    await signIn(page, student);
    const chip = visible(page, "button", "Hozir ochiq");
    await chip.hover();
    await page.mouse.down();
    await page.waitForTimeout(250);
    expect(await chip.evaluate((e) => getComputedStyle(e).scale)).toBe("0.97");
    await page.mouse.up();
    await page.keyboard.press("Escape");
    await page.locator("#wt2-live").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const outline = await page.locator("#wt2-live").evaluate((e) => getComputedStyle(e).outlineColor);
    expect(outline).toBe("rgb(36, 51, 214)");
  });
});

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
] as const) {
  test(`tafsilot ${width}×${height}: ma'lumot va "Chegirmani olish" aylantirmasdan ko'rinadi`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const { student } = await seedPhones();
    await signIn(page, student);
    await page.goto(`/chegirmalar/${await discountId("Osh 0.5 porsiya + ko'k choy")}`);
    const title = page.getByRole("heading", { level: 1 }).locator("visible=true");
    const claim = visible(page, "button", /Chegirmani olish|Olinmoqda/);
    await expect(title).toBeVisible();
    const t = await title.boundingBox();
    const c = await claim.boundingBox();
    expect(t!.y + t!.height).toBeLessThanOrEqual(height);
    expect(c!.y + c!.height).toBeLessThanOrEqual(height);
  });
}

test("oflayn: 'Qayta urinish' tarmoq yo'qligini aytadi, tarmoq qaytganda o'zi yangilanadi", async ({ page, context }) => {
  await page.goto("/oflayn");
  await expect(page.getByTestId("offline-page")).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Qayta urinib ko'rish" }).click();
  await expect(page.getByTestId("still-offline")).toBeVisible();
  await context.setOffline(false);
  await expect(page).not.toHaveURL(/oflayn/, { timeout: 15_000 });

  // qo'lda: tarmoq qaytgach tugma sahifani ochadi
  await page.goto("/oflayn");
  await page.getByRole("button", { name: "Qayta urinib ko'rish" }).click();
  await expect(page).not.toHaveURL(/oflayn/, { timeout: 15_000 });
});
