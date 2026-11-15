import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { clearOtp, FIXED_CODE, local, seedPhones, withDb } from "./helpers";

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

/** Ilova kirishi: telefon → SMS kod (sahifa ochiq bo'lishi kerak). */
async function appCode(page: Page, phone: string, { fill = true } = {}) {
  await clearOtp(phone);
  if (fill) await page.locator("#app-phone").fill(local(phone));
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await page.locator("#app-code").fill(FIXED_CODE);
}

const setPassword = (phone: string, hash: string | null) =>
  withDb((db) => db.query(`UPDATE "User" SET "passwordHash" = $2, "passwordFails" = 0, "passwordLockedUntil" = NULL WHERE phone = $1`, [phone, hash]));
const passwordState = (phone: string) =>
  withDb(async (db) => (await db.query<{ hash: string | null; fails: number; locked: Date | null }>(`SELECT "passwordHash" AS hash, "passwordFails" AS fails, "passwordLockedUntil" AS locked FROM "User" WHERE phone = $1`, [phone])).rows[0]!);

test.describe("ilova: parol", () => {
  test.describe.configure({ mode: "serial" });

  test("parolsiz eski hisob SMS'dan keyin parol o'rnatadi, keyingi safar parol so'raladi", async ({ page, context }) => {
    const { student } = await seedPhones();
    await setPassword(student, null);
    await asNativeApp(context);
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
    await appCode(page, student);

    await expect(page.getByRole("heading", { name: "Parol o'rnating." })).toBeVisible();
    await page.locator("#app-new-password").fill("abc");
    await page.locator("#app-repeat-password").fill("abc");
    await page.getByRole("button", { name: "Saqlash va kirish" }).click();
    await expect(page.getByText("Parol kamida 8 ta belgi bo'lsin, harf va raqam birga.")).toBeVisible();

    await page.locator("#app-new-password").fill("Talaba2026");
    await page.locator("#app-repeat-password").fill("Talaba2027");
    await page.getByRole("button", { name: "Saqlash va kirish" }).click();
    await expect(page.getByText("Parollar bir xil emas.")).toBeVisible();

    await page.locator("#app-repeat-password").fill("Talaba2026");
    await page.getByRole("button", { name: "Saqlash va kirish" }).click();
    await page.waitForURL(/\/uz\/chegirmalar/);
    expect((await passwordState(student)).hash).toMatch(/^scrypt:/);

    // Chiqib ketgandan keyin — "Qayta xush kelibsiz", raqam yozilgan, endi parol so'raladi
    await context.clearCookies({ name: "tp_session" });
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Qayta/ })).toBeVisible();
    await expect(page.locator("#app-phone")).toHaveValue(/\d/);
    await appCode(page, student, { fill: false });
    await expect(page.getByText("Hisobingiz topildi")).toBeVisible();

    await page.locator("#app-password").fill("Notogri123");
    await page.getByRole("button", { name: "Kirish", exact: true }).click();
    await expect(page.getByText("Parol noto'g'ri. Yana 4 ta urinish qoldi.")).toBeVisible();
    expect((await passwordState(student)).fails).toBe(1);

    await page.locator("#app-password").fill("Talaba2026");
    await page.getByRole("button", { name: "Kirish", exact: true }).click();
    await page.waitForURL(/\/uz\/chegirmalar/);
    expect((await passwordState(student)).fails).toBe(0);
  });

  test("5 ta xato parol — qulf; \"Parolni unutdim\" SMS bilan yangi parol o'rnatadi", async ({ page, context }) => {
    const { owner } = await seedPhones();
    await setPassword(owner, null);
    await asNativeApp(context);
    await page.goto("/uz/kirish?rol=biznes", { waitUntil: "networkidle" });
    await appCode(page, owner);
    await page.locator("#app-new-password").fill("Biznes2026");
    await page.locator("#app-repeat-password").fill("Biznes2026");
    await page.getByRole("button", { name: "Saqlash va kirish" }).click();
    await page.waitForURL(/\/uz\/biznes/);

    await context.clearCookies({ name: "tp_session" });
    await page.goto("/uz/kirish?rol=biznes", { waitUntil: "networkidle" });
    await appCode(page, owner);
    for (let i = 0; i < 5; i++) {
      await page.locator("#app-password").fill(`Xato${i}parol`);
      await page.getByRole("button", { name: "Kirish", exact: true }).click();
      if (i < 4) await expect(page.getByText(`Yana ${4 - i} ta urinish qoldi.`)).toBeVisible();
    }
    // Qulf: SMS tasdig'i ham bekor — telefon qadamiga qaytadi
    await expect(page.getByText(/Juda ko'p xato urinish\. 15 daqiqadan keyin/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kod yuborish" })).toBeVisible();
    expect((await passwordState(owner)).locked).not.toBeNull();

    // Qulf paytida to'g'ri parol ham o'tmaydi
    await appCode(page, owner);
    await page.locator("#app-password").fill("Biznes2026");
    await page.getByRole("button", { name: "Kirish", exact: true }).click();
    await expect(page.getByText(/Juda ko'p xato urinish/)).toBeVisible();

    // Parolni unutdim: yangi SMS → yangi parol → kirish, qulf ochiladi
    await appCode(page, owner);
    await page.getByRole("button", { name: "Parolni unutdim" }).click();
    await expect(page.getByRole("heading", { name: "Yangi parol." })).toBeVisible();
    await page.locator("#app-new-password").fill("Yangi2026parol");
    await page.locator("#app-repeat-password").fill("Yangi2026parol");
    await page.getByRole("button", { name: "Saqlash va kirish" }).click();
    await page.waitForURL(/\/uz\/biznes/);
    const state = await passwordState(owner);
    expect(state.locked).toBeNull();
    expect(state.fails).toBe(0);
  });

  test("yangi raqam: kod → parol → ro'yxat formasi (hisob bor-yo'qligi koddan oldin aytilmaydi)", async ({ page, context }) => {
    const phone = `+99899${String(Date.now()).slice(-7)}`;
    await asNativeApp(context);
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
    await clearOtp(phone);
    await page.locator("#app-phone").fill(local(phone));
    await page.getByRole("button", { name: "Kod yuborish" }).click();
    // Kod ekrani yangi va mavjud raqam uchun bir xil
    await expect(page.getByText("Yangi raqam bo'lsa, keyingi qadamda parol o'rnatasiz.", { exact: false })).toBeVisible();
    await page.locator("#app-code").fill(FIXED_CODE);
    await expect(page.getByRole("heading", { name: "Parol o'rnating." })).toBeVisible();
    await page.locator("#app-new-password").fill("Talaba2026");
    await page.locator("#app-repeat-password").fill("Talaba2026");
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.waitForURL(/\/uz\/talaba\/royxat/);
  });
});
