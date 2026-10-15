import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

/** Admin boshqaruvi: o'z ismi, yangi admin, foydalanuvchi tahriri (telefon ko'rinadi), universitetlar va so'rovlar. */
test.use({ viewport: { width: 1440, height: 1100 } });
test.setTimeout(120_000);

let phones: SeedPhones;
const NEW_ADMIN = "+998905550871";
const REQ_STUDENT = { id: "e2e_mng_student", phone: "+998905550872" };
const UNI = "E2E Sinov Universiteti";
const UNI_REQ = "E2E Xayoliy Institut";
let adminBefore: { id: string; firstName: string | null; lastName: string | null };

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "UniversityRequest" WHERE "userId" = $1`, [REQ_STUDENT.id]);
    await db.query(`DELETE FROM "StudentProfile" WHERE "userId" = $1`, [REQ_STUDENT.id]);
    await db.query(`DELETE FROM "AuditLog" WHERE "entityId" IN (SELECT id FROM "User" WHERE phone = ANY($1)) OR "entityId" = $2`, [[NEW_ADMIN, REQ_STUDENT.phone], REQ_STUDENT.id]);
    await db.query(`DELETE FROM "User" WHERE phone = ANY($1) OR id = $2`, [[NEW_ADMIN, REQ_STUDENT.phone], REQ_STUDENT.id]);
    await db.query(`DELETE FROM "University" WHERE name LIKE 'E2E %'`);
  });
}

test.beforeAll(async () => {
  phones = await seedPhones();
  adminBefore = await withDb(async (db) => (await db.query(`SELECT id, "firstName", "lastName" FROM "User" WHERE phone = $1`, [phones.admin])).rows[0]);
});
test.beforeEach(cleanup);
test.afterAll(async () => {
  await cleanup();
  await withDb((db) => db.query(`UPDATE "User" SET "firstName" = $2, "lastName" = $3 WHERE id = $1`, [adminBefore.id, adminBefore.firstName, adminBefore.lastName]));
});

async function adminIn(page: Page) {
  await signIn(page, phones.admin);
  await expect(page).toHaveURL("/admin");
}
const saved = (page: Page) => expect(page.getByTestId("manage-saved").first()).toBeVisible();

test("admin o'z ismini o'zgartiradi va yangi admin qo'shadi (audit bilan)", async ({ page }) => {
  await adminIn(page);
  await page.goto("/admin/profil", { waitUntil: "networkidle" });
  await page.locator("#own-first").fill("Dilnoza");
  await page.locator("#own-last").fill("Karimova");
  await page.getByRole("button", { name: "Saqlash" }).click();
  await saved(page);
  expect(await withDb(async (db) => (await db.query(`SELECT "firstName", "lastName" FROM "User" WHERE id = $1`, [adminBefore.id])).rows[0])).toEqual({ firstName: "Dilnoza", lastName: "Karimova" });
  // Yon paneldagi ism ham yangilanadi
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /Dilnoza Karimova/ })).toBeVisible();

  // Noto'g'ri raqam rad etiladi, to'g'risi qo'shiladi
  await page.locator("#new-first").fill("Yangi");
  await page.locator("#new-last").fill("Moderator");
  await page.locator("#new-phone").fill("12345");
  await page.getByRole("button", { name: "Admin qo'shish" }).click();
  await expect(page.getByText("Telefonni +998 bilan, 9 raqam qilib kiriting.")).toBeVisible();
  // React forma amalidan keyin maydonlarni tozalaydi — qayta to'ldirib, qiymat turganini tekshiramiz
  await page.waitForTimeout(500);
  await page.locator("#new-first").fill("Yangi");
  await page.locator("#new-last").fill("Moderator");
  await page.locator("#new-phone").fill(NEW_ADMIN);
  await expect(page.locator("#new-phone")).toHaveValue(NEW_ADMIN);
  await page.getByRole("button", { name: "Admin qo'shish" }).click();
  await expect(page.getByText("Admin qo'shildi")).toBeVisible();
  const created = await withDb(async (db) => (await db.query(`SELECT id, role FROM "User" WHERE phone = $1`, [NEW_ADMIN])).rows[0] as { id: string; role: string });
  expect(created.role).toBe("ADMIN");
  await expect(page.getByText("+998 90 555 08 71")).toBeVisible();
  const actions = await withDb(async (db) => (await db.query(`SELECT action FROM "AuditLog" WHERE "actorId" = $1 AND action IN ('admin.profile.update','admin.create')`, [adminBefore.id])).rows.map((r) => r.action as string));
  expect(actions).toEqual(expect.arrayContaining(["admin.profile.update", "admin.create"]));

  // Band raqam (talaba raqami) rad etiladi
  await page.waitForTimeout(500);
  await page.locator("#new-first").fill("Yana");
  await page.locator("#new-last").fill("Moderator");
  await page.locator("#new-phone").fill(phones.student);
  await page.getByRole("button", { name: "Admin qo'shish" }).click();
  await expect(page.getByText("Bu raqam tizimda allaqachon bor.")).toBeVisible();
});

test("foydalanuvchilar: talabani qidirib telefonini ko'radi va ma'lumotini tahrirlaydi; biznes ma'lumotlari", async ({ page }) => {
  await adminIn(page);
  await page.goto(`/admin/foydalanuvchilar?q=${encodeURIComponent(phones.student.slice(-9))}`, { waitUntil: "networkidle" });
  const row = page.getByRole("row").filter({ hasText: "+998 90 412 37 85" });
  await expect(row).toBeVisible();
  await row.getByRole("link").first().click();
  await expect(page.locator("#u-phone")).toHaveValue(phones.student);
  const before = await withDb(async (db) => (await db.query(`SELECT s.faculty FROM "StudentProfile" s JOIN "User" u ON u.id = s."userId" WHERE u.phone = $1`, [phones.student])).rows[0].faculty as string | null);
  await page.locator("#u-faculty").fill("E2E fakultet");
  await page.getByRole("button", { name: "Saqlash" }).first().click();
  await saved(page);
  expect(await withDb(async (db) => (await db.query(`SELECT s.faculty FROM "StudentProfile" s JOIN "User" u ON u.id = s."userId" WHERE u.phone = $1`, [phones.student])).rows[0].faculty)).toBe("E2E fakultet");
  await withDb((db) => db.query(`UPDATE "StudentProfile" SET faculty = $2 WHERE "userId" = (SELECT id FROM "User" WHERE phone = $1)`, [phones.student, before]));
  await expect(page.getByText("user.edit").first()).toBeVisible();

  // Biznes egasi: biznes ma'lumotlari formasi ham ochiladi
  await page.goto(`/admin/foydalanuvchilar?rol=BUSINESS_OWNER&q=Bodom`, { waitUntil: "networkidle" });
  await page.getByRole("row").filter({ hasText: "Bodom" }).getByRole("link").first().click();
  await expect(page.locator("#b-name")).toHaveValue("Bodom Choyxonasi");
  await expect(page.locator("#b-publicPhone")).toBeVisible();
});

test("universitetlar: qidiruv, qo'shish, tahrirlash; 'Ro'yxatda yo'q' so'rovi yangi OTM sifatida yopiladi", async ({ page }) => {
  await adminIn(page);
  await page.goto("/admin/universitetlar?q=tatu", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Toshkent axborot texnologiyalari universiteti" }).first()).toBeVisible();

  await page.locator("#add-name").fill(UNI);
  await page.locator("#add-short").fill("E2E");
  await page.locator("#add-region").fill("Samarqand viloyati");
  await page.getByRole("button", { name: "Qo'shish", exact: true }).click();
  await saved(page);
  await page.goto(`/admin/universitetlar?q=${encodeURIComponent(UNI)}`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: UNI }).click();
  await page.locator("#edit-short").fill("E2E2");
  await page.getByRole("button", { name: "Saqlash" }).click();
  await saved(page);
  expect(await withDb(async (db) => (await db.query(`SELECT "shortName", source FROM "University" WHERE name = $1`, [UNI])).rows[0])).toEqual({ shortName: "E2E2", source: "admin" });

  // So'rov: talaba "Ro'yxatda yo'q" yozgan
  await withDb(async (db) => {
    const other = (await db.query(`SELECT id FROM "University" WHERE kind = 'OTHER' LIMIT 1`)).rows[0].id;
    await db.query(`INSERT INTO "User" (id, phone, role, "firstName", "lastName", "updatedAt") VALUES ($1, $2, 'STUDENT', 'Sinov', 'So''rov', now())`, [REQ_STUDENT.id, REQ_STUDENT.phone]);
    await db.query(`INSERT INTO "StudentProfile" ("userId", "universityId", course, "publicId", status, "updatedAt") VALUES ($1, $2, 'C1', 'TP-E2E-0001', 'DRAFT', now())`, [REQ_STUDENT.id, other]);
    await db.query(`INSERT INTO "UniversityRequest" (id, "userId", name) VALUES ('e2e_mng_req', $1, $2)`, [REQ_STUDENT.id, UNI_REQ]);
  });
  await page.goto("/admin/universitetlar", { waitUntil: "networkidle" });
  const request = page.getByTestId("university-request").filter({ hasText: UNI_REQ });
  await expect(request).toBeVisible();
  await request.getByText("Yangi universitet sifatida qo'shish").first().click();
  await request.getByRole("button", { name: "Yangi universitet sifatida qo'shish" }).click();
  await expect(page.getByTestId("university-request").filter({ hasText: UNI_REQ })).toHaveCount(0);
  const result = await withDb(async (db) =>
    (await db.query(`SELECT un.name, un.kind, r.status FROM "StudentProfile" s JOIN "University" un ON un.id = s."universityId" JOIN "UniversityRequest" r ON r."userId" = s."userId" WHERE s."userId" = $1`, [REQ_STUDENT.id])).rows[0],
  );
  expect(result).toMatchObject({ name: UNI_REQ, status: "RESOLVED" });
  expect(result.kind).not.toBe("OTHER");
});
