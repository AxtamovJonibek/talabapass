import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, type SeedPhones } from "./helpers";

/**
 * Telefon ko'rinishi: 360 / 390 / 430 kenglikda sahifalar yon tomonga siljimaydi (gorizontal scroll yo'q),
 * kirish sahifasidagi bezak sarlavha va matn ustiga tushmaydi (+ skrinshot).
 */
const WIDTHS = [360, 390, 430] as const;

const PAGES = {
  guest: ["/", "/kirish", "/kirish?rol=biznes", "/talaba/royxat", "/biznes/royxat", "/huquqiy/maxfiylik", "/huquqiy/shartlar", "/huquqiy/biznes"],
  student: ["/chegirmalar", "/kuponlar", "/tarix", "/profil", "/profil/tahrir", "/bildirishnomalar", "/yordam"],
  owner: ["/biznes", "/biznes/chegirmalar", "/biznes/chegirma/yangi", "/biznes/profil", "/biznes/profil/tahrir", "/biznes/kassirlar", "/biznes/sotuvlar", "/biznes/bildirishnomalar"],
} as const;

async function overflowOf(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

let phones: SeedPhones;
test.beforeAll(async () => {
  phones = await seedPhones();
});

for (const width of WIDTHS) {
  test.describe(`telefon ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });
    test.setTimeout(4 * 60_000);

    for (const role of ["guest", "student", "owner"] as const) {
      test(`${role}: gorizontal siljish yo'q`, async ({ page }) => {
        if (role !== "guest") await signIn(page, phones[role]);
        const bad: string[] = [];
        for (const path of PAGES[role]) {
          await page.goto(path, { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle").catch(() => undefined);
          const extra = await overflowOf(page);
          if (extra > 0) bad.push(`${path}: +${extra}px`);
        }
        expect(bad, bad.join("\n")).toEqual([]);
      });
    }

    for (const rol of ["student", "biznes"] as const) {
      test(`kirish (${rol}): bezak matn ustiga tushmaydi`, async ({ page }) => {
        await page.goto(`/kirish?rol=${rol}`, { waitUntil: "networkidle" });
        const covered = await page.evaluate(() => {
          const panel = document.querySelector("h1")!.closest("div.relative")!.parentElement!;
          const targets = [...panel.querySelectorAll<HTMLElement>("a, h1, p")];
          return targets.filter((el) => {
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return top !== null && !el.contains(top) && !top.contains(el);
          }).length;
        });
        expect(covered).toBe(0);
        await expect(page).toHaveScreenshot(`kirish-${rol}-${width}.png`, { maxDiffPixelRatio: 0.02 });
      });
    }
  });
}

test("biznes telefon profilida 'Hisobdan chiqish' bor va ishlaydi", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, phones.owner);
  await page.goto("/biznes/profil", { waitUntil: "networkidle" });
  const logout = page.getByRole("button", { name: "Hisobdan chiqish" }).locator("visible=true");
  await logout.scrollIntoViewIfNeeded();
  await logout.click();
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/kirish");
  await page.goto("/biznes");
  await expect(page).toHaveURL(/\/kirish/);
});
