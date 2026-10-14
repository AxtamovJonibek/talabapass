import { expect, test, type Page } from "@playwright/test";
import { createUploadToken } from "../src/server/student/upload-token";
import { codeBox, enterCode, FIXED_CODE, local, seedPhones, withDb, sampleJpeg } from "./helpers";

// Veb ko'rinish (WT1) va kompyuter → telefon o'tkazmasi
test.use({ viewport: { width: 1440, height: 1000 } });

const STUDENT = "+998905550811";
let JPEG: Buffer;
const SECRET = process.env.AUTH_SECRET!;

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "User" WHERE phone = $1`, [STUDENT]);
    await db.query(`DELETE FROM "OtpCode" WHERE phone = $1`, [STUDENT]);
    await db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'otp-ip:%'`);
  });
}
test.beforeAll(async () => {
  JPEG = await sampleJpeg();
});
test.beforeEach(cleanup);
test.afterAll(cleanup);

const student = () =>
  withDb(async (db) => (await db.query(`SELECT u.id, s.status FROM "User" u JOIN "StudentProfile" s ON s."userId" = u.id WHERE u.phone = $1`, [STUDENT])).rows[0] as { id: string; status: string });

async function registerOnWeb(page: Page) {
  await page.goto("/talaba/royxat", { waitUntil: "networkidle" });
  await page.locator("#web-phone").fill(local(STUDENT));
  await page.locator("#web-first").fill("Veb");
  await page.locator("#web-last").fill("Sinovchi");
  await page.locator("#web-uni").selectOption({ label: "O'zbekiston Milliy universiteti" });
  await page.getByRole("button", { name: "Magistratura" }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await expect(codeBox(page)).toBeEnabled();
  await enterCode(page, FIXED_CODE);
  await expect(page).toHaveURL("/talaba/guvohnoma");
}

test("veb: forma → kod → fayl yuklash → tekshiruv", async ({ page }) => {
  await registerOnWeb(page);
  await expect(page.getByRole("heading", { name: "Talaba guvohnomasi" })).toBeVisible();

  await page.waitForLoadState("networkidle");
  await page.getByTestId("card-file-web").setInputFiles({ name: "guvohnoma.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await expect(page.getByTestId("upload-row")).toContainText("Yuklandi");
  expect((await student()).status).toBe("PENDING");

  await page.getByRole("button", { name: "Tekshiruvga yuborish" }).click();
  await expect(page).toHaveURL("/talaba/tekshiruv");
  await expect(page.getByRole("heading", { name: "Hujjatingizni tekshiryapmiz" })).toBeVisible();
  await expect(page.getByText("Moderatorda")).toBeVisible();
  await expect(page.getByText(/^\d+-o'rin$/)).toBeVisible();
});

test("veb: yaroqsiz fayl rad etiladi", async ({ page }) => {
  await registerOnWeb(page);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("card-file-web").setInputFiles({ name: "guvohnoma.pdf", mimeType: "application/pdf", buffer: Buffer.from("bu pdf emas") });
  await expect(page.getByRole("alert").filter({ hasText: "Faqat JPG, PNG, HEIC yoki PDF fayl yuklang" })).toBeVisible();
  await expect(page.getByTestId("upload-row")).toHaveCount(0);
  expect((await student()).status).toBe("DRAFT");
});

test("telefon bilan rasmga olish: telefonda kirmasdan yuklanadi, kompyuterdagi sahifa o'zi yangilanadi", async ({ page, browser }) => {
  await registerOnWeb(page);
  const { id } = await student();

  // Telefon — alohida brauzer, sessiyasiz; ruxsat faqat QR'dagi token
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phonePage = await phone.newPage();
  await phonePage.goto(`/talaba/guvohnoma/telefon?t=${encodeURIComponent(createUploadToken(id, SECRET))}`, { waitUntil: "networkidle" });
  await phonePage.waitForLoadState("networkidle");
  await phonePage.getByTestId("card-file").setInputFiles({ name: "telefondan.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await expect(phonePage.getByText("Rasm yuborildi")).toBeVisible();
  // token sessiya bermaydi
  expect((await phone.cookies()).some((c) => c.name === "tp_session")).toBe(false);
  await phonePage.goto("/chegirmalar");
  await expect(phonePage).toHaveURL("/kirish");
  await phone.close();

  await expect(page.getByTestId("upload-row")).toContainText("telefondan.jpg", { timeout: 15_000 });
  await expect(page.getByTestId("upload-row")).toContainText("Yuklandi");
});

test("o'tkazma tokeni: eskirgan, buzilgan va begona tokenlar ishlamaydi", async ({ page, request }) => {
  await registerOnWeb(page);
  const { id } = await student();
  const upload = (token: string) =>
    request.post("/api/talaba/guvohnoma", { data: JPEG, headers: { "content-type": "application/octet-stream", "x-upload-token": token } });

  const expired = createUploadToken(id, SECRET, new Date(Date.now() - 16 * 60_000));
  expect((await upload(expired)).status(), "eskirgan").toBe(401);
  expect((await upload(createUploadToken(id, "boshqa-sir".repeat(4)))).status(), "boshqa sir").toBe(401);
  expect((await upload("yaroqsiz")).status(), "yaroqsiz").toBe(401);
  expect((await student()).status).toBe("DRAFT");

  // Tasdiqlangan talaba nomidan token bilan ham qayta yuklab bo'lmaydi
  const approved = await withDb(async (db) => (await db.query(`SELECT id FROM "User" WHERE phone = $1`, [(await seedPhones()).student])).rows[0].id);
  expect((await upload(createUploadToken(approved, SECRET))).status(), "tasdiqlangan talaba").toBe(403);

  await page.goto(`/talaba/guvohnoma/telefon?t=${encodeURIComponent(expired)}`);
  await expect(page.getByText("Havola eskirgan")).toBeVisible();

  expect((await upload(createUploadToken(id, SECRET))).status(), "to'g'ri token").toBe(201);
  expect((await student()).status).toBe("PENDING");
});
