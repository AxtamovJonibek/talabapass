import { createHash } from "node:crypto";
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { sampleJpeg, seedPhones, signIn, withDb } from "./helpers";

// A2 — admin tekshiruvi: talabalar va bizneslar
test.use({ viewport: { width: 1440, height: 1000 } });

const S1 = { id: "e2e_rev_s1", phone: "+998905550831", token: "e2e-rev-s1", first: "Arizachi", last: "Birinchi" };
const S2 = { id: "e2e_rev_s2", phone: "+998905550832", token: "e2e-rev-s2", first: "Arizachi", last: "Ikkinchi" };
const OWNER = { id: "e2e_rev_owner", phone: "+998905550833", token: "e2e-rev-owner" };
const CASHIER = { id: "e2e_rev_cashier", phone: "+998905550834", token: "e2e-rev-cashier" };
const BUSINESS = "e2e_rev_biz";
const USERS = [S1, S2, OWNER, CASHIER];
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "Business" WHERE id = $1`, [BUSINESS]);
    await db.query(`DELETE FROM "User" WHERE id = ANY($1)`, [USERS.map((u) => u.id)]);
    await db.query(`DELETE FROM "OtpCode" WHERE phone = ANY($1)`, [USERS.map((u) => u.phone)]);
    await db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'otp-ip:%'`);
  });
}

/** Talaba (DRAFT) + tayyor sessiya, so'ng guvohnomani haqiqiy yuklash manzili orqali yuboradi. */
async function pendingStudent(request: APIRequestContext, s: typeof S1): Promise<string> {
  await withDb(async (db) => {
    const uni = (await db.query(`SELECT id FROM "University" WHERE "shortName" = 'TATU'`)).rows[0].id;
    await db.query(`INSERT INTO "User" (id, phone, role, "firstName", "lastName", "updatedAt") VALUES ($1, $2, 'STUDENT', $3, $4, now())`, [s.id, s.phone, s.first, s.last]);
    await db.query(`INSERT INTO "StudentProfile" ("userId", "universityId", course, "publicId", "updatedAt") VALUES ($1, $2, 'C2', $3, now())`, [s.id, uni, `TP-E2E-${s.id.slice(-2)}`]);
    await db.query(`INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt") VALUES ($1, $1, $2, now() + interval '1 day')`.replace("$1, $1", "$1 || '_s', $1"), [s.id, hash(s.token)]);
  });
  const response = await request.post("/api/talaba/guvohnoma", {
    data: await sampleJpeg(),
    headers: { "content-type": "application/octet-stream", cookie: `tp_session=${s.token}`, "x-file-name": "guvohnoma.jpg" },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).verificationId as string;
}

async function sessionCount(userId: string) {
  return withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "Session" WHERE "userId" = $1`, [userId])).rows[0].n as number);
}

async function asAdmin(page: Page) {
  await signIn(page, (await seedPhones()).admin);
  await expect(page).toHaveURL("/admin");
}

async function loggedIn(context: BrowserContext, token: string, baseURL: string) {
  await context.addCookies([{ name: "tp_session", value: token, url: baseURL }]);
}

test.beforeEach(cleanup);
test.afterAll(cleanup);

test.describe("talaba arizasi", () => {
  test("guvohnoma rasmi faqat adminga ochiladi va har bir ko'rish audit'ga yoziladi", async ({ page, request, browser, baseURL }) => {
    const verificationId = await pendingStudent(request, S1);
    const fileUrl = `/api/admin/fayl/guvohnoma/${verificationId}`;

    // Kirmagan, talabaning o'zi va boshqa rollar — bir xil 404 (fayl borligi ham oshkor qilinmaydi)
    expect((await request.get(fileUrl)).status()).toBe(404);
    expect((await request.get(fileUrl, { headers: { cookie: `tp_session=${S1.token}` } })).status()).toBe(404);
    const student = await browser.newContext();
    await loggedIn(student, S1.token, baseURL!);
    expect((await student.request.get(fileUrl)).status()).toBe(404);
    await student.close();

    const before = await withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'file.view' AND "entityId" = $1`, [verificationId])).rows[0].n);
    expect(before).toBe(0);

    await asAdmin(page);
    await page.goto(`/admin/talabalar?id=${verificationId}`);
    await expect(page.getByRole("heading", { name: `${S1.first} ${S1.last}` })).toBeVisible();
    const img = page.locator(`img[src="${fileUrl}"]`);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    const direct = await page.request.get(`${fileUrl}?maqsad=full`);
    expect(direct.status()).toBe(200);
    expect(direct.headers()["cache-control"]).toContain("no-store");
    expect(direct.headers()["x-content-type-options"]).toBe("nosniff");

    const views = await withDb(async (db) =>
      (await db.query(`SELECT a."actorId", a.meta FROM "AuditLog" a WHERE action = 'file.view' AND "entityId" = $1 ORDER BY "createdAt"`, [verificationId])).rows,
    );
    expect(views.length).toBeGreaterThanOrEqual(2);
    const adminId = await withDb(async (db) => (await db.query(`SELECT id FROM "User" WHERE phone = '+998900000001'`)).rows[0].id);
    expect(views.every((v) => v.actorId === adminId)).toBe(true);
    expect(views.map((v) => v.meta.purpose)).toContain("full");
  });

  test("tasdiqlash: guvohnoma № va muddat talab qilinadi, takroriy raqam va o'tgan muddat rad etiladi", async ({ page, request }) => {
    const first = await pendingStudent(request, S1);
    const second = await pendingStudent(request, S2);
    await asAdmin(page);

    await page.goto(`/admin/talabalar?id=${first}`);
    await page.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Guvohnoma raqamini" })).toBeVisible();

    await page.getByLabel("Guvohnoma №").fill("tatu-24-e2e01");
    await page.getByLabel("Amal muddati").fill("2020-06-30");
    await expect(page.getByRole("cell", { name: "O'tgan" })).toBeVisible();
    await page.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "muddati o'tgan" })).toBeVisible();

    await page.getByLabel("Amal muddati").fill("2028-06-30");
    await page.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(page).not.toHaveURL(new RegExp(first));

    const approved = await withDb(async (db) => (await db.query(`SELECT status, "cardNumber", "cardExpiresAt"::text AS exp FROM "StudentProfile" WHERE "userId" = $1`, [S1.id])).rows[0]);
    expect(approved).toEqual({ status: "APPROVED", cardNumber: "TATU-24-E2E01", exp: "2028-06-30" });

    // Ikkinchi talaba shu guvohnoma raqami bilan tasdiqlanmaydi
    await page.goto(`/admin/talabalar?id=${second}`);
    await page.getByLabel("Guvohnoma №").fill("TATU-24-E2E01");
    await page.getByLabel("Amal muddati").fill("2028-06-30");
    await page.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "boshqa hisobda bor" })).toBeVisible();
    const status = await withDb(async (db) => (await db.query(`SELECT status FROM "StudentProfile" WHERE "userId" = $1`, [S2.id])).rows[0].status);
    expect(status).toBe("PENDING");

    const audit = await withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'student.approve' AND "entityId" = $1`, [first])).rows[0].n);
    expect(audit).toBe(1);
  });

  test("tasdiqlangan talabaga ilova ochiladi", async ({ page, request, browser, baseURL }) => {
    const id = await pendingStudent(request, S1);
    await asAdmin(page);
    await page.goto(`/admin/talabalar?id=${id}`);
    await page.getByLabel("Guvohnoma №").fill("TATU-24-E2E02");
    await page.getByLabel("Amal muddati").fill("2028-06-30");
    await page.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(page).not.toHaveURL(new RegExp(id));

    const student = await browser.newContext();
    await loggedIn(student, S1.token, baseURL!);
    const studentPage = await student.newPage();
    await studentPage.goto("/chegirmalar");
    await expect(studentPage).toHaveURL("/chegirmalar");
    await student.close();
  });

  test("rad etish: sabab talabaga ko'rinadi", async ({ page, request, browser, baseURL }) => {
    const id = await pendingStudent(request, S1);
    await asAdmin(page);
    await page.goto(`/admin/talabalar?id=${id}`);
    await page.getByLabel("Rad etish sababi").selectOption({ label: "Rasm aniq emas" });
    await page.getByRole("button", { name: "Rad etish" }).click();
    await expect(page).not.toHaveURL(new RegExp(id));

    const student = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await loggedIn(student, S1.token, baseURL!);
    const studentPage = await student.newPage();
    await studentPage.goto("/talaba/tekshiruv");
    await expect(studentPage.getByTestId("status-stamp")).toHaveText("RAD ETILDI");
    await expect(studentPage.getByText("Rasm aniq emas").locator("visible=true")).toBeVisible();
    await student.close();
  });

  test("bloklash: talabaning barcha sessiyalari darhol yopiladi, qayta kira olmaydi", async ({ page, request, browser, baseURL }) => {
    const id = await pendingStudent(request, S1);
    // Talaba ikkinchi qurilmada ham kirgan
    await withDb((db) => db.query(`INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt") VALUES ('e2e_rev_s1_s2', $1, $2, now() + interval '1 day')`, [S1.id, hash("e2e-rev-s1-b")]));
    expect(await sessionCount(S1.id)).toBe(2);

    await asAdmin(page);
    await page.goto(`/admin/talabalar?id=${id}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Bloklash" }).click();
    await expect(page).not.toHaveURL(new RegExp(id));

    expect(await sessionCount(S1.id)).toBe(0);
    const user = await withDb(async (db) => (await db.query(`SELECT status FROM "User" WHERE id = $1`, [S1.id])).rows[0]);
    expect(user.status).toBe("BLOCKED");

    const student = await browser.newContext();
    await loggedIn(student, S1.token, baseURL!);
    const studentPage = await student.newPage();
    await studentPage.goto("/talaba/tekshiruv");
    await expect(studentPage).toHaveURL("/kirish");
    await student.close();
  });

  test("bloklashdan voz kechilsa hech narsa o'zgarmaydi", async ({ page, request }) => {
    const id = await pendingStudent(request, S1);
    await asAdmin(page);
    await page.goto(`/admin/talabalar?id=${id}`);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Bloklash" }).click();
    await expect(page).toHaveURL(new RegExp(id));
    expect(await sessionCount(S1.id)).toBe(1);
  });

  test("admin bo'lmagan foydalanuvchi qaror qabul qila olmaydi (server action ham tekshiradi)", async ({ page, request }) => {
    const id = await pendingStudent(request, S1);
    const { owner } = await seedPhones();
    await signIn(page, owner);
    await expect(page).toHaveURL("/biznes");
    await page.goto(`/admin/talabalar?id=${id}`);
    await expect(page).toHaveURL("/biznes");
  });
});

test.describe("biznes arizasi", () => {
  async function pendingBusiness() {
    await withDb(async (db) => {
      for (const u of [OWNER, CASHIER]) {
        await db.query(`INSERT INTO "User" (id, phone, role, "updatedAt") VALUES ($1, $2, $3, now())`, [u.id, u.phone, u === OWNER ? "BUSINESS_OWNER" : "CASHIER"]);
        await db.query(`INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt") VALUES ($1 || '_s', $1, $2, now() + interval '1 day')`, [u.id, hash(u.token)]);
      }
      await db.query(
        `INSERT INTO "Business" (id, "ownerId", name, kind, address, "workingHours", tin, status, "updatedAt", "createdAt")
         VALUES ($1, $2, 'E2E Kafe', 'CAFE', 'Test ko''chasi 1', '09:00–18:00', '399000111', 'PENDING', now(), now() - interval '10 days')`,
        [BUSINESS, OWNER.id],
      );
      await db.query(`INSERT INTO "BusinessMember" (id, "businessId", "userId", role) VALUES ('e2e_rev_m1', $1, $2, 'OWNER'), ('e2e_rev_m2', $1, $3, 'CASHIER')`, [BUSINESS, OWNER.id, CASHIER.id]);
    });
  }

  test("tasdiqlash", async ({ page }) => {
    await pendingBusiness();
    await asAdmin(page);
    await page.goto(`/admin/bizneslar?id=${BUSINESS}`);
    await expect(page.getByRole("heading", { name: "E2E Kafe" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Yagona" })).toBeVisible();
    await page.getByRole("button", { name: "Tasdiqlash" }).click();
    await expect(page).not.toHaveURL(new RegExp(BUSINESS));
    const status = await withDb(async (db) => (await db.query(`SELECT status FROM "Business" WHERE id = $1`, [BUSINESS])).rows[0].status);
    expect(status).toBe("APPROVED");
  });

  test("rad etish sabab bilan", async ({ page }) => {
    await pendingBusiness();
    await asAdmin(page);
    await page.goto(`/admin/bizneslar?id=${BUSINESS}`);
    await page.getByLabel("Rad etish sababi").selectOption({ label: "Hujjatlar to'liq emas" });
    await page.getByRole("button", { name: "Rad etish" }).click();
    await expect(page).not.toHaveURL(new RegExp(BUSINESS));
    const row = await withDb(async (db) => (await db.query(`SELECT status, "rejectReason" FROM "Business" WHERE id = $1`, [BUSINESS])).rows[0]);
    expect(row).toEqual({ status: "REJECTED", rejectReason: "Hujjatlar to'liq emas" });
  });

  test("bloklash: egasi va kassirining sessiyalari darhol yopiladi", async ({ page }) => {
    await pendingBusiness();
    expect(await sessionCount(OWNER.id)).toBe(1);
    expect(await sessionCount(CASHIER.id)).toBe(1);

    await asAdmin(page);
    await page.goto(`/admin/bizneslar?id=${BUSINESS}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Bloklash" }).click();
    await expect(page).not.toHaveURL(new RegExp(BUSINESS));

    expect(await sessionCount(OWNER.id)).toBe(0);
    expect(await sessionCount(CASHIER.id)).toBe(0);
    const status = await withDb(async (db) => (await db.query(`SELECT status FROM "Business" WHERE id = $1`, [BUSINESS])).rows[0].status);
    expect(status).toBe("BLOCKED");
  });
});
