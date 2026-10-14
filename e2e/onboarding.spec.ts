import { expect, test, type Page } from "@playwright/test";
import { codeBox, clearOtp, enterCode, FIXED_CODE, local, requestCode, seedPhones, signIn, withDb, sampleJpeg } from "./helpers";

// Faqat shu testlar ishlatadigan raqamlar
const NEW_STUDENT = "+998905550801";
const FROM_LOGIN = "+998905550802";
const EXPIRING = "+998905550803";
const PHONES = [NEW_STUDENT, FROM_LOGIN, EXPIRING];

let JPEG: Buffer;

async function removeTestStudents() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "User" WHERE phone = ANY($1)`, [PHONES]);
    await db.query(`DELETE FROM "OtpCode" WHERE phone = ANY($1)`, [PHONES]);
    await db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'otp-ip:%'`);
  });
}

async function fillRegistration(page: Page, phone: string | null) {
  if (phone) await page.locator("#reg-phone").fill(local(phone));
  await page.locator("#reg-first").fill("Sinov");
  await page.locator("#reg-last").fill("Talabayev");
  await page.locator("#reg-uni").selectOption({ label: "Toshkent axborot texnologiyalari universiteti" });
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
}

const studentStatus = (phone: string) =>
  withDb(async (db) => (await db.query(`SELECT s.status FROM "StudentProfile" s JOIN "User" u ON u.id = s."userId" WHERE u.phone = $1`, [phone])).rows[0]?.status);

test.beforeAll(async () => {
  JPEG = await sampleJpeg();
});
test.beforeEach(removeTestStudents);
test.afterAll(removeTestStudents);

test.describe("talaba ro'yxati", () => {
  test("to'liq oqim: forma → SMS kod → guvohnoma yuklash → tekshiruvda", async ({ page }) => {
    await page.goto("/talaba/royxat", { waitUntil: "networkidle" });
    await fillRegistration(page, NEW_STUDENT);

    // Raqam egaligi SMS kod bilan tasdiqlanadi
    await expect(codeBox(page)).toBeEnabled();
    expect(await studentStatus(NEW_STUDENT), "koddan oldin hisob ochilmaydi").toBeUndefined();
    await enterCode(page, FIXED_CODE);

    await expect(page).toHaveURL("/talaba/guvohnoma");
    expect(await studentStatus(NEW_STUDENT)).toBe("DRAFT");

    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "guvohnoma_old.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/talaba/tekshiruv");
    await expect(page.getByTestId("status-stamp")).toHaveText("TEKSHIRUVDA");
    await expect(page.getByText("Sinov Talabayev")).toBeVisible();
    await expect(page.getByText("TATU · 3-kurs")).toBeVisible();
    await expect(page.getByText("guvohnoma_old.jpg · 1 KB")).toBeVisible();
    expect(await studentStatus(NEW_STUDENT)).toBe("PENDING");

    // Tasdiqlanmaguncha ilova ochilmaydi
    await page.goto("/chegirmalar");
    await expect(page).toHaveURL("/talaba/tekshiruv");
  });

  test("kirish sahifasida tasdiqlangan raqam bilan kelganda kod qayta so'ralmaydi", async ({ page }) => {
    await signIn(page, FROM_LOGIN);
    await expect(page).toHaveURL("/talaba/royxat");
    await expect(page.locator("#reg-phone")).toHaveValue(/90 555 08 02/);
    await expect(page.locator("#reg-phone")).toHaveAttribute("readonly", "");

    await fillRegistration(page, null);
    await expect(page).toHaveURL("/talaba/guvohnoma");
    expect(await studentStatus(FROM_LOGIN)).toBe("DRAFT");
    const codes = await withDb((db) => db.query(`SELECT count(*)::int AS n FROM "OtpCode" WHERE phone = $1`, [FROM_LOGIN]));
    expect(codes.rows[0].n, "faqat kirishdagi bitta kod").toBe(1);
  });

  test("to'ldirilmagan forma: xatolar ko'rsatiladi, SMS yuborilmaydi", async ({ page }) => {
    await page.goto("/talaba/royxat", { waitUntil: "networkidle" });
    await page.locator("#reg-phone").fill(local(NEW_STUDENT));
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page.getByText("Ismingizni kiriting.").locator("visible=true")).toBeVisible();
    await expect(page.getByText("Familiyangizni kiriting.").locator("visible=true")).toBeVisible();
    await expect(page.getByText("Kursni tanlang.").locator("visible=true")).toBeVisible();
    const codes = await withDb((db) => db.query(`SELECT count(*)::int AS n FROM "OtpCode" WHERE phone = $1`, [NEW_STUDENT]));
    expect(codes.rows[0].n).toBe(0);
  });

  test("ro'yxatdan o'tgan raqam bilan qayta ro'yxat: kod tasdiqlangach mavjud hisobga kiriladi", async ({ page }) => {
    const { student } = await seedPhones();
    await clearOtp(student);
    await page.goto("/talaba/royxat", { waitUntil: "networkidle" });
    await fillRegistration(page, student);
    await expect(codeBox(page)).toBeEnabled();
    await enterCode(page, FIXED_CODE);
    await expect(page).toHaveURL("/chegirmalar");
    // mavjud hisob ma'lumotlari o'zgarmagan
    const name = await withDb((db) => db.query(`SELECT "firstName" FROM "User" WHERE phone = $1`, [student]));
    expect(name.rows[0].firstName).toBe("Dilnoza");
  });
});

test.describe("guvohnoma yuklash", () => {
  async function registered(page: Page) {
    await page.goto("/talaba/royxat", { waitUntil: "networkidle" });
    await fillRegistration(page, NEW_STUDENT);
    await expect(codeBox(page)).toBeEnabled();
    await enterCode(page, FIXED_CODE);
    await expect(page).toHaveURL("/talaba/guvohnoma");
  }

  test("rasm/PDF bo'lmagan fayl rad etiladi (nomi .jpg bo'lsa ham)", async ({ page }) => {
    await registered(page);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "guvohnoma.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<html><script>alert(1)</script>") });
    await expect(page.getByText("Faqat JPG, PNG, HEIC yoki PDF fayl yuklang")).toBeVisible();
    await expect(page).toHaveURL("/talaba/guvohnoma");
    expect(await studentStatus(NEW_STUDENT)).toBe("DRAFT");
  });

  test("yuklash manzili: kirmagan va boshqa roldagi foydalanuvchi uchun yopiq", async ({ page, request }) => {
    const anonymous = await request.post("/api/talaba/guvohnoma", { data: JPEG, headers: { "content-type": "application/octet-stream" } });
    expect(anonymous.status()).toBe(401);

    const { admin } = await seedPhones();
    await signIn(page, admin);
    await expect(page).toHaveURL("/admin/talabalar");
    const asAdmin = await page.request.post("/api/talaba/guvohnoma", { data: JPEG, headers: { "content-type": "application/octet-stream" } });
    expect(asAdmin.status()).toBe(401);
  });

  test("yuklangan fayl hech qanday manzil orqali ochilmaydi", async ({ page }) => {
    await registered(page);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "guvohnoma.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/talaba/tekshiruv");

    const key = await withDb(async (db) => (await db.query(`SELECT v."fileKey" FROM "Verification" v JOIN "User" u ON u.id = v."studentId" WHERE u.phone = $1`, [NEW_STUDENT])).rows[0].fileKey);
    for (const path of [`/${key}`, `/.data/private/${key}`, `/api/talaba/guvohnoma/${key}`, `/_next/${key}`]) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBeGreaterThanOrEqual(400);
      expect((await response.body()).includes(JPEG.subarray(0, 4)), path).toBe(false);
    }
    expect((await page.request.get("/api/talaba/guvohnoma")).status()).toBe(405);
  });
});

test.describe("holatga qarab yo'naltirish", () => {
  test("rad etilgan talaba sababni ko'radi va qayta yuklay oladi", async ({ page, context }) => {
    // scripts/compare-fixtures.mjs dagi tayyor foydalanuvchi o'rniga shu yerda yaratamiz
    await page.goto("/talaba/royxat", { waitUntil: "networkidle" });
    await fillRegistration(page, NEW_STUDENT);
    await expect(codeBox(page)).toBeEnabled();
    await enterCode(page, FIXED_CODE);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "xira.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/talaba/tekshiruv");

    await withDb(async (db) => {
      await db.query(`UPDATE "Verification" SET status = 'REJECTED', "rejectReason" = 'Rasm aniq emas' WHERE "studentId" = (SELECT id FROM "User" WHERE phone = $1)`, [NEW_STUDENT]);
      await db.query(`UPDATE "StudentProfile" SET status = 'REJECTED' WHERE "userId" = (SELECT id FROM "User" WHERE phone = $1)`, [NEW_STUDENT]);
    });
    await page.reload();
    await expect(page.getByTestId("status-stamp")).toHaveText("RAD ETILDI");
    await expect(page.getByText("Rasm aniq emas").locator("visible=true")).toBeVisible();

    await page.getByRole("link", { name: "Boshqa rasm yuklash" }).click();
    await expect(page).toHaveURL("/talaba/guvohnoma");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "aniq.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/talaba/tekshiruv");
    await expect(page.getByTestId("status-stamp")).toHaveText("TEKSHIRUVDA");
    expect(context.pages()).toHaveLength(1);
  });

  test("guvohnoma muddati o'tgan talaba: ilova yopiladi, yangi guvohnoma so'raladi", async ({ page }) => {
    // Tasdiqlangan, lekin kechagi kun bilan muddati tugagan talaba
    await withDb(async (db) => {
      const uni = (await db.query(`SELECT id FROM "University" LIMIT 1`)).rows[0].id;
      await db.query(`INSERT INTO "User" (id, phone, role, "firstName", "lastName", "updatedAt") VALUES ('e2e_expiring', $1, 'STUDENT', 'Muddat', 'Tugagan', now())`, [EXPIRING]);
      await db.query(
        `INSERT INTO "StudentProfile" ("userId", "universityId", course, "publicId", status, "cardNumber", "cardExpiresAt", "updatedAt")
         VALUES ('e2e_expiring', $1, 'C4', 'TP-E2E-0001', 'APPROVED', 'E2E-0001', (now() AT TIME ZONE 'Asia/Tashkent')::date - 1, now())`,
        [uni],
      );
    });

    await requestCode(page, EXPIRING);
    await enterCode(page, FIXED_CODE);
    // Bazada hali APPROVED, lekin tekshiruv so'rov vaqtida bajariladi — cron kutilmaydi
    await expect(page).toHaveURL("/talaba/guvohnoma");
    await expect(page.getByText("Guvohnomangiz muddati tugadi")).toBeVisible();
    expect(await studentStatus(EXPIRING)).toBe("EXPIRED");

    await page.goto("/chegirmalar");
    await expect(page).toHaveURL("/talaba/guvohnoma");

    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "yangi.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/talaba/tekshiruv");
    expect(await studentStatus(EXPIRING)).toBe("PENDING");
  });

  test("muddatning oxirgi kunida talaba hali faol", async ({ page }) => {
    await withDb(async (db) => {
      const uni = (await db.query(`SELECT id FROM "University" LIMIT 1`)).rows[0].id;
      await db.query(`INSERT INTO "User" (id, phone, role, "firstName", "lastName", "updatedAt") VALUES ('e2e_expiring', $1, 'STUDENT', 'Oxirgi', 'Kun', now())`, [EXPIRING]);
      await db.query(
        `INSERT INTO "StudentProfile" ("userId", "universityId", course, "publicId", status, "cardNumber", "cardExpiresAt", "updatedAt")
         VALUES ('e2e_expiring', $1, 'C4', 'TP-E2E-0001', 'APPROVED', 'E2E-0001', (now() AT TIME ZONE 'Asia/Tashkent')::date, now())`,
        [uni],
      );
    });
    await requestCode(page, EXPIRING);
    await enterCode(page, FIXED_CODE);
    await expect(page).toHaveURL("/chegirmalar");
    expect(await studentStatus(EXPIRING)).toBe("APPROVED");
  });
});
