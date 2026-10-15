import { expect, test } from "@playwright/test";
import { ADMIN_PASSWORD, enterAdminPassword, seedPhones, signIn, withDb } from "./helpers";

// Admin ikkinchi qadami: SMS koddan keyin parol. Parolsiz admin sahifalari va admin API ochilmaydi.

let admin: { id: string; phone: string };

const failCount = () =>
  withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'admin.password.fail' AND "actorId" = $1`, [admin.id])).rows[0].n as number);

async function clearPasswordAttempts() {
  await withDb((db) => db.query(`DELETE FROM "AuditLog" WHERE action LIKE 'admin.password.%' AND "actorId" = $1`, [admin.id]));
}

test.beforeAll(async () => {
  const phone = (await seedPhones()).admin;
  const id = await withDb(async (db) => (await db.query(`SELECT id FROM "User" WHERE phone = $1`, [phone])).rows[0].id as string);
  admin = { id, phone };
});
test.beforeEach(() => clearPasswordAttempts());
test.afterAll(() => clearPasswordAttempts());

test("SMS koddan keyin parol so'raladi; parolsiz admin sahifalari va API ochilmaydi", async ({ page }) => {
  test.slow(); // 7 ta sahifa — dev serverda birinchi kompilyatsiya uzoq
  await signIn(page, admin.phone, { adminPassword: false });
  await expect(page).toHaveURL("/kirish/admin");
  await expect(page.getByRole("heading", { name: "Admin paroli" })).toBeVisible();

  for (const path of ["/admin", "/admin/talabalar", "/admin/bizneslar", "/admin/chegirmalar", "/admin/tranzaksiyalar", "/admin/bildirishnomalar", "/admin/bloklanganlar", "/chegirmalar", "/biznes", "/kirish"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL("/kirish/admin");
  }
  const verificationId = await withDb(async (db) => (await db.query(`SELECT id FROM "Verification" LIMIT 1`)).rows[0]?.id as string | undefined);
  const api = await page.request.get(`/api/admin/fayl/guvohnoma/${verificationId ?? "x"}`);
  expect(api.status()).toBe(404);

  await enterAdminPassword(page);
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { name: "Platforma" })).toBeVisible();
  if (verificationId) expect((await page.request.get(`/api/admin/fayl/guvohnoma/${verificationId}`)).status()).toBe(200);
});

test("noto'g'ri parol rad etiladi va audit'ga yoziladi", async ({ page }) => {
  await signIn(page, admin.phone, { adminPassword: false });
  await enterAdminPassword(page, "noto'g'ri-parol");
  await expect(page.getByText("Parol noto'g'ri")).toBeVisible();
  await expect(page).toHaveURL("/kirish/admin");
  await expect.poll(failCount).toBe(1);
  await enterAdminPassword(page);
  await expect(page).toHaveURL("/admin");
});

test("5 ta xato: sessiya yopiladi, 15 daqiqa to'g'ri parol ham qabul qilinmaydi", async ({ page }) => {
  await signIn(page, admin.phone, { adminPassword: false });
  for (let i = 1; i <= 4; i++) {
    await enterAdminPassword(page, `xato-${i}`);
    await expect.poll(failCount).toBe(i);
    await expect(page.getByText("Parol noto'g'ri")).toBeVisible();
  }
  await enterAdminPassword(page, "xato-5");
  await expect(page.getByText(/Juda ko'p xato urinish/)).toBeVisible();
  const sessions = await withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "Session" WHERE "userId" = $1`, [admin.id])).rows[0].n);
  expect(sessions).toBe(0);

  // SMS bilan qayta kirsa ham parol bloklangan
  await signIn(page, admin.phone, { adminPassword: false });
  await enterAdminPassword(page, ADMIN_PASSWORD);
  await expect(page.getByText(/Juda ko'p xato urinish/)).toBeVisible();
  await page.goto("/admin/talabalar");
  await expect(page).toHaveURL("/kirish/admin");
});

test("parol boshqa sessiyaga o'tmaydi: chiqib qayta kirganda yana so'raladi", async ({ page }) => {
  await signIn(page, admin.phone);
  await expect(page).toHaveURL("/admin");
  await page.getByRole("button", { name: "Hisobdan chiqish" }).click();
  await expect(page).toHaveURL("/");
  await signIn(page, admin.phone, { adminPassword: false });
  await page.goto("/admin/talabalar");
  await expect(page).toHaveURL("/kirish/admin");
});
