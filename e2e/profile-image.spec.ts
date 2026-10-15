import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

/**
 * Profil rasmi: talaba avatari va biznes logotipi — tanlash, kesish oynasi (kattalashtirish, burish), yuklash,
 * ko'rinishi, ruxsatlar va o'chirish.
 */
let phones: SeedPhones;
test.beforeAll(async () => {
  phones = await seedPhones();
});

/** Kvadrat emas, rangli rasm: kesish natijasi 512×512 bo'lishi kerak. */
const photo = () => sharp({ create: { width: 900, height: 600, channels: 3, background: "#2433d6" } }).jpeg().toBuffer();

async function pick(page: Page, label: string, name: string, mimeType: string, buffer: Buffer) {
  await page.getByLabel(label).locator("visible=true").setInputFiles({ name, mimeType, buffer });
}

async function crop(page: Page) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("crop-canvas")).toBeVisible();
  await dialog.getByRole("button", { name: "O'ngga" }).click();
  await dialog.getByRole("button", { name: "Kattalashtirish", exact: true }).first().click();
  await dialog.getByRole("slider", { name: "Kattalashtirish" }).fill("2.5");
  await dialog.getByRole("button", { name: "Saqlash" }).click();
  await expect(dialog).toBeHidden();
}

test("talaba: avatar yuklanadi, 512×512 kvadrat, boshqalarga yopiq, o'chiriladi", async ({ page, browser }) => {
  test.slow();
  await signIn(page, phones.student);
  await page.goto("/profil/tahrir", { waitUntil: "networkidle" });

  // Rasm bo'lmagan fayl — kesish oynasida xato
  await pick(page, "Rasm tanlash", "x.jpg", "image/jpeg", Buffer.from("bu rasm emas"));
  await expect(page.getByRole("alert").filter({ hasText: "Bu rasmni ochib bo'lmadi" })).toBeVisible();
  await page.getByRole("button", { name: "Bekor qilish" }).click();

  await pick(page, "Rasm tanlash", "me.jpg", "image/jpeg", await photo());
  await crop(page);
  const preview = page.getByTestId("avatar-preview").locator("visible=true").locator("img");
  await expect(preview).toBeVisible();

  const userId = await withDb(async (db) => (await db.query(`SELECT "userId", "avatarKey" FROM "StudentProfile" sp JOIN "User" u ON u.id = sp."userId" WHERE u.phone = $1`, [phones.student])).rows[0] as { userId: string; avatarKey: string });
  expect(userId.avatarKey).toMatch(/^avatars\/.+\.jpg$/);

  // O'zi ko'radi: 512×512
  const own = await page.request.get(`/api/avatar/${userId.userId}`);
  expect(own.status()).toBe(200);
  const meta = await sharp(await own.body()).metadata();
  expect([meta.width, meta.height]).toEqual([512, 512]);

  // Mehmon va boshqa talaba ko'rmaydi
  const guest = await browser.newContext();
  expect((await guest.request.get(`/api/avatar/${userId.userId}`)).status()).toBe(404);
  await guest.close();

  // Lentada ham chiqadi (veb sarlavha doirasi)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/chegirmalar", { waitUntil: "networkidle" });
  await expect(page.locator(`header a[href$="/profil"] img[src*="/api/avatar/"]`)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });

  // O'chirish
  await page.goto("/profil/tahrir", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Rasmni o'chirish" }).locator("visible=true").click();
  await expect(page.getByTestId("avatar-preview").locator("visible=true").locator("img")).toHaveCount(0);
  expect((await page.request.get(`/api/avatar/${userId.userId}`)).status()).toBe(404);
});

test("biznes: logotip yuklanadi; tasdiqlangan biznesniki hammaga ochiq", async ({ page, browser }) => {
  test.slow();
  await signIn(page, phones.owner);
  await page.goto("/biznes/profil/tahrir", { waitUntil: "networkidle" });
  await pick(page, "Logotip tanlash", "logo.png", "image/png", await sharp({ create: { width: 300, height: 300, channels: 4, background: "#ff5b1f" } }).png().toBuffer());
  await crop(page);
  await expect(page.getByTestId("avatar-preview").locator("visible=true").locator("img")).toBeVisible();

  const business = await withDb(async (db) => (await db.query(`SELECT b.id, b."logoKey", b.status FROM "Business" b JOIN "User" u ON u.id = b."ownerId" WHERE u.phone = $1 ORDER BY b."createdAt" LIMIT 1`, [phones.owner])).rows[0] as { id: string; logoKey: string; status: string });
  expect(business.logoKey).toMatch(/^business\/.+\/logo-.+\.jpg$/);

  const guest = await browser.newContext();
  const anon = await guest.request.get(`/api/biznes/logo/${business.id}`);
  expect(anon.status()).toBe(200);
  expect(anon.headers()["content-type"]).toBe("image/jpeg");
  await guest.close();

  // Profil sarlavhasida logotip
  await page.goto("/biznes/profil", { waitUntil: "networkidle" });
  await expect(page.locator(`img[src*="/api/biznes/logo/"]`).locator("visible=true").first()).toBeVisible();

  await page.goto("/biznes/profil/tahrir", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Rasmni o'chirish" }).locator("visible=true").click();
  await expect(page.getByTestId("avatar-preview").locator("visible=true").locator("img")).toHaveCount(0);
  expect((await page.request.get(`/api/biznes/logo/${business.id}`)).status()).toBe(404);
});
