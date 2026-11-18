import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { clearOtp, FIXED_CODE, local, sampleJpeg, seedPhones, withDb } from "./helpers";

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

  test("brauzerda /ilova — mobil ilova haqida ochiq sahifa (karusel yo'q), /kirish o'zgarmagan", async ({ page }) => {
    await page.goto("/uz/ilova");
    await expect(page).toHaveURL(/\/uz\/ilova$/);
    await expect(page.getByRole("heading", { level: 1, name: "Talaba Pass ilovasi" })).toBeVisible();
    await expect(page.getByLabel("Google Play — tez orada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Davom etish" })).toHaveCount(0);
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

    // RoyxatTalaba → Guvohnoma → Tekshiruv (saytdagi maydonlar va action'lar)
    await expect(page.getByRole("heading", { name: /haqingizda/ })).toBeVisible();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page.getByText("Ismingizni kiriting.")).toBeVisible();
    await page.locator("#app-first").fill("Dilnoza");
    await page.locator("#app-last").fill("Karimova");
    await page.locator("#app-uni").click();
    await page.keyboard.type("TATU");
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "3", exact: true }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();

    await page.waitForURL(/\/uz\/talaba\/guvohnoma/);
    await expect(page.getByRole("heading", { name: /ramkaga/ })).toBeVisible();
    await page.getByTestId("card-file").setInputFiles({ name: "guvohnoma.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() });
    await page.waitForURL(/\/uz\/talaba\/tekshiruv/);
    await expect(page.getByTestId("status-stamp")).toHaveText("TEKSHIRUVDA");
    await expect(page.getByText("Ma'lumotlar yuborildi")).toBeVisible();

    // Ilovada o'rnatilgan parol hisob ochilganda yozilgan
    expect((await passwordState(phone)).hash).toMatch(/^scrypt:/);
  });

  test("yangi biznes: kod → parol → 3 qadam → tekshiruvda", async ({ page, context }) => {
    const phone = `+99897${String(Date.now()).slice(-7)}`;
    const tin = String(Date.now()).slice(-9);
    const jpg = { name: "guvohnoma.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() };
    await asNativeApp(context);
    await page.goto("/uz/kirish?rol=biznes", { waitUntil: "networkidle" });
    await appCode(page, phone);
    await expect(page.getByText("Biznes", { exact: true })).toBeVisible();
    await page.locator("#app-new-password").fill("Biznes2026");
    await page.locator("#app-repeat-password").fill("Biznes2026");
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.waitForURL(/\/uz\/biznes\/royxat/);

    // 1/4: nom, kategoriya, manzil — qadam maydonlari brauzerda tekshiriladi
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page.locator("#app-biz-name")).toBeVisible();
    await page.locator("#app-biz-name").fill("Ilova Kofe");
    await page.getByRole("button", { name: "Kafe / restoran" }).click();
    await page.locator("#app-biz-address").fill("Toshkent, Chilonzor 9");
    await page.getByRole("button", { name: "Davom etish" }).click();

    // 2/4: ish vaqti, STIR, tavsif
    await expect(page.getByRole("heading", { name: /STIR/ })).toBeVisible();
    await page.locator("#app-biz-hours").fill("09:00 – 23:00");
    await page.locator("#app-biz-tin").fill(tin);
    await page.locator("#app-biz-desc").fill("Qahva va desert");
    await page.getByRole("button", { name: "Keyingi: hujjatlar" }).click();

    // 3/4: mas'ul shaxs, guvohnoma, foto, rozilik
    await page.locator("#app-biz-contact").fill("Aziz Karimov");
    await page.getByText("Faylni tanlang").locator("..").locator("..").locator("input[type=file]").setInputFiles(jpg);
    await page.getByLabel("Foto qo'shish").locator("input[type=file]").setInputFiles({ ...jpg, name: "zal.jpg" });
    await page.getByText("bilan tanishdim va roziman").click();
    await page.getByRole("button", { name: "Tekshiruvga yuborish" }).click();

    // 4/4: tekshiruvda
    await page.waitForURL((url) => url.pathname === "/uz/biznes");
    await expect(page.getByTestId("business-stamp")).toHaveText("TEKSHIRUVDA");
    await expect(page.getByRole("link", { name: "Chegirma yaratish" })).toBeVisible();
    expect((await passwordState(phone)).hash).toMatch(/^scrypt:/);
  });
});
