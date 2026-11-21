import { expect, test, type Page } from "@playwright/test";
import { clearOtp, enterCode, fillNewPassword, FIXED_CODE, reachRegistrationDetails, requestCode, seedPhones, signIn, webRegisterStudent, withDb, sampleJpeg, toPhoneStep } from "./helpers";

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

const studentStatus = (phone: string) =>
  withDb(async (db) => (await db.query(`SELECT s.status FROM "StudentProfile" s JOIN "User" u ON u.id = s."userId" WHERE u.phone = $1`, [phone])).rows[0]?.status);

test.beforeAll(async () => {
  JPEG = await sampleJpeg();
});
test.beforeEach(removeTestStudents);
test.afterAll(removeTestStudents);

test.describe("talaba ro'yxati", () => {
  test("universitet qidiruvli tanlov; 'Ro'yxatda yo'q' — matn kiritiladi, admin uchun so'rov yoziladi", async ({ page }) => {
    await reachRegistrationDetails(page, NEW_STUDENT);
    // Viloyat bo'yicha qidiruv
    await page.locator("#reg-uni").fill("andijon tibbiyot");
    await expect(page.getByRole("option", { name: /Andijon davlat tibbiyot instituti/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Samarqand/ })).toHaveCount(0);

    await page.locator("#reg-first").fill("Sinov");
    await page.locator("#reg-last").fill("Talabayev");
    await page.locator("#reg-uni").fill("bunday oliygoh yo'q");
    await page.getByRole("option", { name: "Ro'yxatda yo'q" }).click();
    await page.getByRole("button", { name: "3", exact: true }).click();
    // Qidiruvga yozilgan matn nom maydoniga o'tadi; bo'sh qoldirilsa — xato
    await expect(page.locator("#reg-uni")).toHaveValue("bunday oliygoh yo'q");
    await page.locator("#reg-uni").fill("");
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page.getByText("Maydonni to'g'ri to'ldiring.").first()).toBeVisible();
    await page.locator("#reg-uni").fill("Xayoliy Texnologiyalar Instituti");
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page).toHaveURL("/uz/talaba/guvohnoma");

    const rows = await withDb(async (db) =>
      (await db.query(`SELECT r.name, r.status, un.kind FROM "UniversityRequest" r JOIN "User" u ON u.id = r."userId" JOIN "StudentProfile" s ON s."userId" = u.id JOIN "University" un ON un.id = s."universityId" WHERE u.phone = $1`, [NEW_STUDENT])).rows,
    );
    expect(rows).toEqual([{ name: "Xayoliy Texnologiyalar Instituti", status: "PENDING", kind: "OTHER" }]);
  });

  test("to'liq oqim: telefon → SMS kod → parol → ma'lumotlar → guvohnoma yuklash → tekshiruvda", async ({ page }) => {
    await reachRegistrationDetails(page, NEW_STUDENT);
    // Raqam egaligi SMS kod bilan tasdiqlandi, hisob esa ma'lumotlardan keyin ochiladi
    expect(await studentStatus(NEW_STUDENT), "ma'lumotlardan oldin hisob ochilmaydi").toBeUndefined();
    await page.locator("#reg-first").fill("Sinov");
    await page.locator("#reg-last").fill("Talabayev");
    await page.locator("#reg-uni").fill("tatu");
    await page.getByRole("option", { name: /^Toshkent axborot texnologiyalari universiteti/ }).first().click();
    await page.getByRole("button", { name: "3", exact: true }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();

    await expect(page).toHaveURL("/uz/talaba/guvohnoma");
    expect(await studentStatus(NEW_STUDENT)).toBe("DRAFT");

    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "guvohnoma_old.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/uz/talaba/tekshiruv");
    await expect(page.getByTestId("status-stamp")).toHaveText("TEKSHIRUVDA");
    await expect(page.getByText("Sinov Talabayev")).toBeVisible();
    await expect(page.getByText("TATU · 3-kurs")).toBeVisible();
    await expect(page.getByText("guvohnoma_old.jpg · 1 KB")).toBeVisible();
    expect(await studentStatus(NEW_STUDENT)).toBe("PENDING");

    // Tasdiqlanmaguncha ilova ochilmaydi
    await page.goto("/uz/chegirmalar");
    await expect(page).toHaveURL("/uz/talaba/tekshiruv");
  });

  test("to'ldirilmagan forma: xatolar ko'rsatiladi, hisob ochilmaydi", async ({ page }) => {
    await reachRegistrationDetails(page, NEW_STUDENT);
    await page.getByRole("button", { name: "Davom etish" }).click();
    await expect(page.getByText("Maydonni to'g'ri to'ldiring.").first()).toBeVisible();
    expect(await studentStatus(NEW_STUDENT)).toBeUndefined();
  });

  test("ro'yxatdan o'tgan raqam bilan qayta ro'yxat: kod tasdiqlangach hisob topiladi, parol so'raladi", async ({ page }) => {
    const { student } = await seedPhones();
    await clearOtp(student);
    await page.goto("/uz/talaba/royxat", { waitUntil: "networkidle" });
    await toPhoneStep(page, "Telefon raqam bilan");
    await page.locator("#login-phone").fill(student.replace(/^\+998/, ""));
    await page.getByRole("button", { name: "Kod yuborish" }).click();
    await enterCode(page, FIXED_CODE);
    await expect(page.getByText("Hisobingiz topildi.")).toBeVisible();
    // mavjud hisob ma'lumotlari o'zgarmagan
    const name = await withDb((db) => db.query(`SELECT "firstName" FROM "User" WHERE phone = $1`, [student]));
    expect(name.rows[0].firstName).toBe("Dilnoza");
  });
});

test.describe("guvohnoma yuklash", () => {
  async function registered(page: Page) {
    await webRegisterStudent(page, NEW_STUDENT);
    await expect(page).toHaveURL("/uz/talaba/guvohnoma");
  }

  test("rasm/PDF bo'lmagan fayl rad etiladi (nomi .jpg bo'lsa ham)", async ({ page }) => {
    await registered(page);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "guvohnoma.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<html><script>alert(1)</script>") });
    await expect(page.getByText("Faqat JPG, PNG, HEIC yoki PDF fayl yuklang")).toBeVisible();
    await expect(page).toHaveURL("/uz/talaba/guvohnoma");
    expect(await studentStatus(NEW_STUDENT)).toBe("DRAFT");
  });

  test("yuklash manzili: kirmagan va boshqa roldagi foydalanuvchi uchun yopiq", async ({ page, request }) => {
    const anonymous = await request.post("/api/talaba/guvohnoma", { data: JPEG, headers: { "content-type": "application/octet-stream" } });
    expect(anonymous.status()).toBe(401);

    const { admin } = await seedPhones();
    await signIn(page, admin);
    await expect(page).toHaveURL("/uz/admin");
    const asAdmin = await page.request.post("/api/talaba/guvohnoma", { data: JPEG, headers: { "content-type": "application/octet-stream" } });
    expect(asAdmin.status()).toBe(401);
  });

  test("yuklangan fayl hech qanday manzil orqali ochilmaydi", async ({ page }) => {
    await registered(page);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "guvohnoma.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/uz/talaba/tekshiruv");

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
    await webRegisterStudent(page, NEW_STUDENT);
    await expect(page).toHaveURL("/uz/talaba/guvohnoma");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "xira.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/uz/talaba/tekshiruv");

    await withDb(async (db) => {
      await db.query(`UPDATE "Verification" SET status = 'REJECTED', "rejectReason" = 'Rasm aniq emas' WHERE "studentId" = (SELECT id FROM "User" WHERE phone = $1)`, [NEW_STUDENT]);
      await db.query(`UPDATE "StudentProfile" SET status = 'REJECTED' WHERE "userId" = (SELECT id FROM "User" WHERE phone = $1)`, [NEW_STUDENT]);
    });
    await page.reload();
    await expect(page.getByTestId("status-stamp")).toHaveText("RAD ETILDI");
    await expect(page.getByText("Rasm aniq emas").locator("visible=true")).toBeVisible();

    await page.getByRole("link", { name: "Boshqa rasm yuklash" }).click();
    await expect(page).toHaveURL("/uz/talaba/guvohnoma");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "aniq.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/uz/talaba/tekshiruv");
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
    await fillNewPassword(page);
    // Bazada hali APPROVED, lekin tekshiruv so'rov vaqtida bajariladi — cron kutilmaydi
    await expect(page).toHaveURL("/uz/talaba/guvohnoma");
    await expect(page.getByText("Guvohnomangiz muddati tugadi")).toBeVisible();
    expect(await studentStatus(EXPIRING)).toBe("EXPIRED");

    await page.goto("/uz/chegirmalar");
    await expect(page).toHaveURL("/uz/talaba/guvohnoma");

    await page.waitForLoadState("networkidle");
    await page.getByTestId("card-file").setInputFiles({ name: "yangi.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page).toHaveURL("/uz/talaba/tekshiruv");
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
    await fillNewPassword(page);
    await expect(page).toHaveURL("/uz/chegirmalar");
    expect(await studentStatus(EXPIRING)).toBe("APPROVED");
  });
});
