import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, ADMIN_PASSWORD, type SeedPhones } from "./helpers";

/**
 * Navigatsiya: har bir rol (+ mehmon) × 390 va 1440 — bosh sahifadan boshlab ko'rinadigan barcha ichki havolalar
 * ochiladi (2 qadam chuqurlikda). Har bir sahifa: status < 400, xato/404 ekrani yo'q, bo'sh emas, "tez orada" matni yo'q,
 * havola o'z rolining sahifasiga olib boradi (begona rolga yo'naltirilmaydi).
 *
 * Jonli havolada: `npm run test:e2e:live` (E2E_BASE_URL + `.env.staging` dagi baza). Faqat o'qiydi (GET) —
 * ma'lumot yozmaydi, faqat kirish uchun SMS kod (OTP_FIXED_CODE) ishlatadi.
 */
const MAX_PAGES = 40;
const DEPTH = 2;
/** Havola → kutiladigan yakuniy yo'l (bitta faol kupon bo'lsa `/kuponlar` kupon sahifasiga o'tadi). */
const REDIRECTS: Record<string, RegExp> = { "/kuponlar": /^\/kuponlar(\/[^/]+)?$/ };
const STUBS = /keyingi bosqichlarda|tez orada|coming soon|Application error/i;

type Role = "guest" | "student" | "owner" | "cashier" | "admin";
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1440", width: 1440, height: 900 },
] as const;

const normalize = (href: string, base: string): string | null => {
  if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/.test(href)) return null;
  const url = new URL(href, base);
  if (url.origin !== new URL(base).origin) return null;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return null;
  return url.pathname + url.search;
};

/** Ko'rinib turgan ichki havolalar (PhoneOrWeb ning yashirin ko'rinishidagilari kirmaydi). */
const visibleLinks = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .filter((a) => a.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }) && a.getClientRects().length > 0)
      .map((a) => a.getAttribute("href") ?? ""),
  );

async function crawl(page: Page, base: string, start: string, homeRoles: RegExp, guest: boolean): Promise<string[]> {
  const problems: string[] = [];
  const seen = new Set<string>();
  let frontier = [start];
  for (let depth = 0; depth <= DEPTH && frontier.length > 0 && seen.size < MAX_PAGES; depth++) {
    const next: string[] = [];
    for (const href of frontier) {
      const key = href.split("?")[0]!;
      if (seen.has(key) || seen.size >= MAX_PAGES) continue;
      seen.add(key);
      const response = await page.goto(href, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const path = new URL(page.url()).pathname;
      const status = response?.status() ?? 0;
      if (status >= 400) problems.push(`${href}: status ${status}`);
      const expected = REDIRECTS[key];
      // Mehmon uchun himoyalangan havola (landing'dagi chegirma kartalari) kirish sahifasiga olib boradi — to'g'ri xatti-harakat
      const gate = guest && path === "/kirish" && !/^\/(kirish|huquqiy|talaba|biznes\/royxat)/.test(key);
      if (!gate && (expected ? !expected.test(path) : path !== key)) {
        problems.push(`${href}: ${path} ga yo'naltirildi`);
        continue;
      }
      if ((await page.getByTestId("error-page").count()) + (await page.getByTestId("not-found-page").count()) > 0) problems.push(`${href}: xato/404 ekrani`);
      const text = (await page.locator("body").innerText()).trim();
      if (text.length < 20) problems.push(`${href}: sahifa bo'sh`);
      if (STUBS.test(text)) problems.push(`${href}: vaqtinchalik matn — "${text.match(STUBS)![0]}"`);
      if (!homeRoles.test(path) && !/^\/(huquqiy|kirish|talaba|biznes\/royxat|oflayn)/.test(path)) problems.push(`${href}: begona bo'lim ${path}`);
      for (const link of await visibleLinks(page)) {
        const n = normalize(link, base);
        if (n && !seen.has(n.split("?")[0]!)) next.push(n);
      }
    }
    frontier = [...new Set(next)];
  }
  return problems;
}

const ROLE_PAGES: Record<Role, { start: string; areas: RegExp }> = {
  guest: { start: "/", areas: /^\/($|huquqiy|kirish|talaba\/royxat|biznes\/royxat|oflayn)/ },
  student: { start: "/chegirmalar", areas: /^\/(chegirmalar|kuponlar|tarix|profil|bildirishnomalar|huquqiy|$)/ },
  owner: { start: "/biznes", areas: /^\/(biznes|huquqiy|$)/ },
  cashier: { start: "/biznes/skaner", areas: /^\/(biznes\/skaner|huquqiy|$)/ },
  admin: { start: "/admin", areas: /^\/(admin|huquqiy|$)/ },
};

let phones: SeedPhones;
test.beforeAll(async () => {
  phones = await seedPhones();
});

for (const viewport of VIEWPORTS) {
  test.describe(`navigatsiya ${viewport.name}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.setTimeout(8 * 60_000);

    for (const role of ["guest", "student", "owner", "cashier", "admin"] as const) {
      test(`${role}: barcha havolalar ochiladi`, async ({ page, baseURL }) => {
        if (role !== "guest") {
          await signIn(page, phones[role], { adminPassword: false });
          if (role === "admin" && new URL(page.url()).pathname === "/kirish/admin") {
            await page.locator("#admin-password").fill(process.env.E2E_ADMIN_PASSWORD ?? ADMIN_PASSWORD);
            await page.getByRole("button", { name: "Kirish", exact: true }).click();
            await page.waitForURL((url) => url.pathname !== "/kirish/admin", { timeout: 15_000 }).catch(() => undefined);
            test.skip(new URL(page.url()).pathname === "/kirish/admin", "Admin paroli ma'lum emas (E2E_ADMIN_PASSWORD)");
          }
        }
        const problems = await crawl(page, baseURL!, ROLE_PAGES[role].start, ROLE_PAGES[role].areas, role === "guest");
        expect(problems, problems.join("\n")).toEqual([]);
      });
    }
  });
}

test("oflayn sahifa va 404 ekrani", async ({ page }) => {
  await page.goto("/oflayn");
  await expect(page.getByTestId("offline-page")).toBeVisible();
  const response = await page.goto("/bunday-sahifa-yoq/aslo");
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("not-found-page")).toBeVisible();
});
