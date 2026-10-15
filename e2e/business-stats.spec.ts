import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

// B6 — biznes statistikasi: ko'rsatkichlar bazadagi SQL bilan solishtiriladi (mustaqil so'rovlar), davr, mobil, eksport.
let phones: SeedPhones;
test.beforeAll(async () => {
  phones = await seedPhones();
});

/** Toshkent kuni boshidan (days kun, bugun ham hisobda) — Postgres'ning o'z sana arifmetikasi bilan */
const SINCE = (days: number) => `((now() + interval '5 hours')::date - ${days - 1})::timestamp`;

async function sql(period: 1 | 7 | 30) {
  return withDb(async (db) => {
    const biz = (await db.query(`SELECT id FROM "Business" WHERE name = 'Bodom Choyxonasi'`)).rows[0].id as string;
    const since = SINCE(period);
    const one = async (q: string) => (await db.query(q, [biz])).rows[0];
    const sales = await one(
      `SELECT count(*)::int n, coalesce(sum("paidAmount"),0)::int rev, coalesce(sum("discountAmount"),0)::int disc, count(DISTINCT "studentId")::int students
       FROM "Redemption" WHERE "businessId" = $1 AND "createdAt" + interval '5 hours' >= ${since}`,
    );
    const fresh = await one(
      `SELECT count(*)::int n FROM (SELECT "studentId", min("createdAt") m FROM "Redemption" WHERE "businessId" = $1 GROUP BY 1) s WHERE m + interval '5 hours' >= ${since}`,
    );
    const views = await one(
      `SELECT coalesce(sum(v.count),0)::int n FROM "DiscountView" v JOIN "Discount" d ON d.id = v."discountId" WHERE d."businessId" = $1 AND v.date >= ${since}::date`,
    );
    const qr = await one(`SELECT count(*)::int n FROM "Coupon" c JOIN "Discount" d ON d.id = c."discountId" WHERE d."businessId" = $1 AND c."createdAt" + interval '5 hours' >= ${since}`);
    return { ...sales, fresh: fresh.n as number, views: views.n as number, qr: qr.n as number };
  });
}

const space = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).locator("visible=true");
/** KPI kartasining qiymati (yorliqdan keyingi katta raqam) */
const kpi = (page: Page, label: string) => visible(page, label).locator("xpath=following-sibling::div[1]");

test.describe("veb 1440", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("ko'rsatkichlar bazadagi SQL bilan mos: 30 / 7 kun", async ({ page }) => {
    test.slow();
    await signIn(page, phones.owner);
    await expect(page).toHaveURL("/biznes");
    await expect(page.getByRole("heading", { name: "Statistika" }).locator("visible=true")).toBeVisible();

    for (const period of [30, 7] as const) {
      if (period === 7) {
        await page.getByRole("tab", { name: "7 kun" }).locator("visible=true").click();
        await expect(page).toHaveURL(/davr=7/);
      }
      const expected = await sql(period);
      expect(expected.n).toBeGreaterThan(0);
      await expect(kpi(page, "Sotuvlar")).toHaveText(space(expected.n));
      await expect(visible(page, `so'm · o'rtacha chek ${space(Math.round(expected.rev / expected.n))}`)).toBeVisible();
      // Grafik ustunlari yig'indisi = sotuvlar soni
      const counts = await page.locator("[data-testid=chart-bar]:visible").evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-count"))));
      expect(counts).toHaveLength(period);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(expected.n);
      await expect(kpi(page, "Yangi mijozlar")).toHaveText(space(expected.fresh));
      // Chegirmalar jadvali "Jami": ko'rildi, QR, sotildi, tushum, chegirma
      const total = page.getByTestId("offers-total").locator("visible=true");
      await expect(total.locator("td").nth(2)).toHaveText(space(expected.views));
      await expect(total.locator("td").nth(3)).toHaveText(space(expected.qr));
      await expect(total.locator("td").nth(4)).toHaveText(space(expected.n));
      await expect(total.locator("td").nth(6)).toHaveText(space(expected.rev));
      await expect(total.locator("td").nth(7)).toHaveText(space(expected.disc));
    }
  });

  test("bugun: soatlik grafik; issiqlik xaritasi; sotuvlar ro'yxati va PDF", async ({ page }) => {
    await signIn(page, phones.owner);
    await page.goto("/biznes?davr=1", { waitUntil: "networkidle" });
    const today = await sql(1);
    const counts = await page.locator("[data-testid=chart-bar]:visible").evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-count"))));
    expect(counts.length).toBeGreaterThanOrEqual(15);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(today.n);
    await expect(page.locator("[data-testid=heat-cell]:visible")).not.toHaveCount(0);

    // Oxirgi sotuvlar — 6 ta, "Barcha sotuvlar" sahifasiga o'tadi
    await expect(page.locator("[data-testid=sale-row]:visible")).toHaveCount(6);
    await page.getByRole("link", { name: "Barcha sotuvlar →" }).locator("visible=true").click();
    await expect(page).toHaveURL("/biznes/sotuvlar");
    const month = await sql(30);
    await expect(page.getByTestId("sales-summary").locator("visible=true")).toHaveText(`${space(month.n)} ta sotuv · ${space(month.rev)} so'm`);
    await expect(page.locator("[data-testid=sale-row]:visible")).toHaveCount(25);
    await page.getByRole("link", { name: "Keyingi →" }).locator("visible=true").click();
    await expect(page).toHaveURL(/sahifa=2/);
    // Chek PDF'i egasiga ochiq
    const href = await page.locator("[data-testid=sale-row]:visible a").first().getAttribute("href");
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("pdf");
  });

  test("biznes navigatsiyasi barcha sahifalarda, bo'sh sahifa yo'q", async ({ page }) => {
    test.slow();
    await signIn(page, phones.owner);
    const nav = page.getByRole("navigation", { name: "Asosiy menyu" }).locator("visible=true");
    for (const [path, label] of [
      ["/biznes", "Statistika"],
      ["/biznes/chegirmalar", "Chegirmalar"],
      ["/biznes/sotuvlar", "Sotuvlar va cheklar"],
      ["/biznes/kassirlar", "Kassirlar"],
      ["/biznes/profil", "Biznes profili"],
      ["/biznes/chegirma/yangi", "Chegirmalar"],
    ] as const) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
      await expect(page.getByText("keyingi bosqichlarda quriladi")).toHaveCount(0);
    }
    await page.goto("/biznes");
    await nav.getByRole("link", { name: "Sotuvlar va cheklar" }).click();
    await expect(page).toHaveURL("/biznes/sotuvlar");
    await nav.getByRole("link", { name: "Skaner" }).click();
    await expect(page).toHaveURL("/biznes/skaner");
  });

  test("Excel hisobot: egasiga fayl, kirmagan va kassirga 404", async ({ page, browser }) => {
    test.slow();
    await signIn(page, phones.owner);
    await page.goto("/biznes", { waitUntil: "networkidle" });
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Excel hisobot" }).locator("visible=true").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^talabapass-hisobot-\d{4}-\d{2}-\d{2}-30\.xlsx$/);
    const chunks: Buffer[] = [];
    for await (const chunk of await file.createReadStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).subarray(0, 2).toString()).toBe("PK"); // xlsx — zip

    const guest = await browser.newContext({ baseURL: "http://localhost:3000" });
    expect((await guest.request.get("/api/biznes/hisobot")).status()).toBe(404);
    await guest.close();
    const cashierContext = await browser.newContext({ baseURL: "http://localhost:3000" });
    const cashier = await cashierContext.newPage();
    await signIn(cashier, phones.cashier);
    expect((await cashier.request.get("/api/biznes/hisobot")).status()).toBe(404);
    await cashierContext.close();
  });
});

test.describe("mobil 390", () => {
  test("statistika telefonda: pastki navigatsiya, gorizontal aylanish yo'q", async ({ page }) => {
    await signIn(page, phones.owner);
    await page.goto("/biznes", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Statistika" }).locator("visible=true")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Asosiy menyu" }).locator("visible=true").getByRole("link", { name: "Statistika" })).toHaveAttribute("aria-current", "page");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("[data-testid=chart-bar]:visible")).toHaveCount(30);
    await page.goto("/biznes/sotuvlar", { waitUntil: "networkidle" });
    await expect(page.locator("[data-testid=sale-row]:visible").first()).toBeVisible();
  });
});
