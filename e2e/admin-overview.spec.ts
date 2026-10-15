import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

// 10-bosqich: A1 umumiy, tranzaksiyalar, bloklanganlar, A3 bildirishnomalar
test.use({ viewport: { width: 1440, height: 1000 } });

let phones: SeedPhones;
const BLOCKED = { id: "e2e_ovw_blocked", phone: "+998905550841", first: "Bloklangan", last: "Talaba" };
const TITLE = "E2E xabar";

const spaced = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const TODAY_SQL = `("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date = (now() AT TIME ZONE 'Asia/Tashkent')::date`;

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "Notification" WHERE title LIKE 'E2E %'`);
    await db.query(`DELETE FROM "AuditLog" WHERE "entityId" = $1`, [BLOCKED.id]);
    await db.query(`DELETE FROM "User" WHERE id = $1`, [BLOCKED.id]);
    await db.query(`DELETE FROM "OtpCode" WHERE phone = $1`, [BLOCKED.phone]);
  });
}

test.beforeAll(async () => {
  phones = await seedPhones();
});
test.beforeEach(cleanup);
test.afterAll(cleanup);

/** Admin kirishi: SMS + parol; parol yuborilguncha kutiladi (aks holda keyingi goto uni uzib qo'yadi) */
async function adminIn(page: Page) {
  await signIn(page, phones.admin);
  await expect(page).toHaveURL("/admin");
}

/** KPI kartasi qiymati: yorliq → shu karta ichidagi birinchi katta raqam */
const kpi = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("xpath=..").locator("div").nth(1);

test.describe("A1 — umumiy", () => {
  test("ko'rsatkichlar bazadagi mustaqil hisob bilan mos", async ({ page }) => {
    await adminIn(page);
    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Platforma" })).toBeVisible();

    const [students, businesses, salesToday] = await withDb(async (db) => [
      (await db.query(`SELECT count(*)::int AS n FROM "StudentProfile" p JOIN "User" u ON u.id = p."userId" WHERE p.status = 'APPROVED' AND u.status = 'ACTIVE'`)).rows[0].n as number,
      (await db.query(`SELECT count(*)::int AS n FROM "Business" b JOIN "User" u ON u.id = b."ownerId" WHERE b.status IN ('APPROVED','WARNED') AND u.status = 'ACTIVE'`)).rows[0].n as number,
      (await db.query(`SELECT count(*)::int AS n FROM "Redemption" WHERE ${TODAY_SQL}`)).rows[0].n as number,
    ]);
    await expect(kpi(page, "Tasdiqlangan talabalar")).toHaveText(spaced(students));
    await expect(kpi(page, "Faol bizneslar")).toHaveText(spaced(businesses));
    await expect(kpi(page, "Bugungi sotuvlar")).toHaveText(spaced(salesToday));

    // Reyting: seed'dagi biznesning 30 kunlik sotuvi
    const sold = await withDb(async (db) =>
      (await db.query(`SELECT count(*)::int AS n FROM "Redemption" r JOIN "Business" b ON b.id = r."businessId" WHERE b.name = 'Bodom Choyxonasi' AND (r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date >= ((now() AT TIME ZONE 'Asia/Tashkent')::date - 29)`)).rows[0].n as number,
    );
    const row = page.getByRole("row", { name: /Bodom Choyxonasi/ });
    // Reytingda top-6 ichida bo'lmasligi mumkin (sotuv kam) — bo'lsa raqami mos
    if (await row.count()) await expect(row.getByRole("cell").nth(3)).toHaveText(spaced(sold));

    // Grafik: 30 ta ustun, oxirgisi to'q sariq (bugun)
    await expect(page.getByRole("img", { name: "So'nggi 30 kunlik sotuvlar" }).locator("> div")).toHaveCount(30);
  });

  test("qidiruv tranzaksiyalar sahifasiga o'tadi", async ({ page }) => {
    await adminIn(page);
    await page.getByLabel("Qidiruv").first().fill("Bodom");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/tranzaksiyalar\?q=Bodom/);
    await expect(page.getByLabel("Qidiruv").first()).toHaveValue("Bodom");
  });

  test("kartadagi 'Tekshiruv navbati' tekshiruvga olib boradi", async ({ page }) => {
    await adminIn(page);
    await page.getByRole("link", { name: /Tekshiruv navbati/ }).click();
    await expect(page).toHaveURL("/admin/talabalar");
  });

  for (const [name, width] of [["telefon", 390], ["kompyuter", 1440]] as const) {
    test(`barcha admin sahifalari ${width}px da gorizontal siljimaydi (${name})`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: 900 });
      await adminIn(page);
      for (const path of ["/admin", "/admin/talabalar", "/admin/bizneslar", "/admin/chegirmalar", "/admin/tranzaksiyalar", "/admin/bildirishnomalar", "/admin/bloklanganlar"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("tranzaksiyalar", () => {
  test("filtr holati URL'da saqlanadi; rad etilganlar alohida", async ({ page }) => {
    await adminIn(page);
    await page.goto("/admin/tranzaksiyalar?davr=all");
    await expect(page.getByRole("heading", { level: 1, name: "Tranzaksiyalar" })).toBeVisible();
    const total = await withDb(async (db) => (await db.query(`SELECT (SELECT count(*) FROM "Redemption") + (SELECT count(*) FROM "ScanAttempt" WHERE result <> 'OK') AS n`)).rows[0].n as string);
    await expect(page.getByText(`Jami: ${spaced(Number(total))}`)).toBeVisible();

    await page.getByRole("tab", { name: "Rad etilgan" }).click();
    await expect(page).toHaveURL(/holat=no/);
    await expect(page.getByRole("tab", { name: "Rad etilgan" })).toHaveAttribute("aria-selected", "true");
    for (const cell of await page.locator("tbody tr td:last-child").allTextContents()) expect(cell).toMatch(/^Rad: |Bu filtr/);

    await page.getByRole("tab", { name: "Muvaffaqiyatli" }).click();
    await expect(page).toHaveURL(/holat=ok/);
    for (const cell of await page.locator("tbody tr td:last-child").allTextContents()) expect(cell).toMatch(/^Muvaffaqiyatli|Bu filtr/);
  });

  test("qidiruv natijani toraytiradi", async ({ page }) => {
    await adminIn(page);
    await page.goto("/admin/tranzaksiyalar?davr=all&q=Bodom");
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    for (const text of await page.locator("tbody tr td:nth-child(4)").allTextContents()) expect(text).toContain("Bodom");
    await page.goto("/admin/tranzaksiyalar?davr=all&q=mavjud-emas-xyz");
    await expect(page.getByText("Bu filtr bo'yicha tranzaksiya yo'q.")).toBeVisible();
  });

  test("Excel eksport faqat adminga; parolsiz/anonim — 404", async ({ page, request }) => {
    expect((await request.get("/api/admin/tranzaksiyalar/eksport")).status()).toBe(404);
    await adminIn(page);
    const response = await page.request.get("/api/admin/tranzaksiyalar/eksport?davr=all");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("spreadsheetml");
    expect(response.headers()["cache-control"]).toBe("no-store");
    const logged = await withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'transactions.export'`)).rows[0].n as number);
    expect(logged).toBeGreaterThan(0);
  });
});

test.describe("bloklanganlar", () => {
  test("ro'yxatda ko'rinadi va blokdan chiqariladi", async ({ page }) => {
    await withDb(async (db) => {
      const uni = (await db.query(`SELECT id FROM "University" WHERE "shortName" = 'TATU'`)).rows[0].id;
      await db.query(`INSERT INTO "User" (id, phone, role, "firstName", "lastName", status, "blockedReason", "updatedAt") VALUES ($1, $2, 'STUDENT', $3, $4, 'BLOCKED', 'fake', now())`, [BLOCKED.id, BLOCKED.phone, BLOCKED.first, BLOCKED.last]);
      await db.query(
        `INSERT INTO "StudentProfile" ("userId", "universityId", course, "publicId", status, "cardNumber", "cardExpiresAt", "updatedAt") VALUES ($1, $2, 'C2', 'TP-E2E-BL', 'BLOCKED', 'E2E-OVW-1', now() + interval '1 year', now())`,
        [BLOCKED.id, uni],
      );
    });
    await adminIn(page);
    await page.goto("/admin/bloklanganlar");
    const row = page.getByRole("row", { name: new RegExp(`${BLOCKED.first} ${BLOCKED.last}`) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Takroriy / soxta hujjat")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Blokdan chiqarish" }).click();
    await expect(row).toHaveCount(0);

    const after = await withDb(async (db) => (await db.query(`SELECT u.status AS user_status, p.status AS profile_status FROM "User" u JOIN "StudentProfile" p ON p."userId" = u.id WHERE u.id = $1`, [BLOCKED.id])).rows[0]);
    expect(after).toEqual({ user_status: "ACTIVE", profile_status: "APPROVED" });
    expect(await withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'user.unblock' AND "entityId" = $1`, [BLOCKED.id])).rows[0].n)).toBe(1);
  });
});

test.describe("A3 — bildirishnomalar", () => {
  test("yuborish: talaba qo'ng'iroqda ko'radi, o'qilgach belgi yo'qoladi; tarixda 'Yetkazildi'", async ({ page, browser }) => {
    const uni = await withDb(async (db) => (await db.query(`SELECT u."shortName" AS name FROM "StudentProfile" p JOIN "University" u ON u.id = p."universityId" JOIN "User" x ON x.id = p."userId" WHERE x.phone = $1`, [phones.student])).rows[0].name as string);

    await adminIn(page);
    await page.goto("/admin/bildirishnomalar");
    await expect(page.getByRole("heading", { level: 1, name: "Bildirishnoma yuborish" })).toBeVisible();
    await page.getByRole("button", { name: "Universitet bo'yicha" }).click();
    await page.getByRole("button", { name: new RegExp(`^${uni} ·`) }).click();
    await page.getByLabel("Sarlavha").fill(TITLE);
    await page.getByLabel("Matn", { exact: true }).fill("Bugun faqat seshanba!");
    // Telefondagi ko'rinish matnni darhol aks ettiradi
    await expect(page.getByText(TITLE).first()).toBeVisible();
    await page.getByRole("button", { name: "Yuborish" }).click();
    await expect(page.getByText("Yuborilmoqda — natija pastdagi ro'yxatda.")).toBeVisible();

    await expect.poll(async () => withDb(async (db) => (await db.query(`SELECT status FROM "Notification" WHERE title = $1`, [TITLE])).rows[0]?.status), { timeout: 30_000 }).toBe("SENT");
    await page.reload();
    const row = page.getByRole("row", { name: new RegExp(TITLE) });
    await expect(row.getByText("Yetkazildi")).toBeVisible();

    // Talaba: qo'ng'iroqda yangi belgi, ro'yxatda xabar
    const studentCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const student = await studentCtx.newPage();
    await signIn(student, phones.student);
    await student.goto("/chegirmalar");
    await student.getByRole("link", { name: "Bildirishnomalar" }).locator("visible=true").click();
    await expect(student).toHaveURL("/bildirishnomalar");
    await expect(student.getByText(TITLE)).toBeVisible();
    const item = student.getByRole("link", { name: new RegExp(TITLE) });
    await expect(item.getByLabel("Yangi")).toBeVisible();
    await expect.poll(async () => withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "UserNotification" u JOIN "Notification" n ON n.id = u."notificationId" WHERE n.title = $1 AND u."readAt" IS NOT NULL`, [TITLE])).rows[0].n)).toBeGreaterThan(0);
    await student.reload();
    await expect(student.getByText(TITLE)).toBeVisible();
    await expect(item.getByLabel("Yangi")).toHaveCount(0);
    await studentCtx.close();

    // Admin tarixida ochilish ulushi
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(TITLE) }).getByRole("cell").nth(4)).not.toHaveText("—");
  });

  test("rejalashtirish: kelajakdagi vaqt qabul qilinadi va bekor qilinadi; o'tgan vaqt rad etiladi", async ({ page }) => {
    await adminIn(page);
    await page.goto("/admin/bildirishnomalar");
    await page.getByRole("button", { name: "Barcha talabalar" }).click();
    await page.getByLabel("Sarlavha").fill(`${TITLE} 2`);
    await page.getByLabel("Matn", { exact: true }).fill("Ertaga yuboriladi");
    await page.getByRole("radio", { name: "Rejalashtirish" }).click();

    // O'tgan vaqt
    await page.getByLabel("Yuborish vaqti").fill("2020-01-01T10:00");
    await page.getByRole("button", { name: "Rejalashtirish", exact: true }).click();
    await expect(page.getByText("Vaqt kelajakda bo'lishi kerak")).toBeVisible();
    expect(await withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "Notification" WHERE title = $1`, [`${TITLE} 2`])).rows[0].n)).toBe(0);

    // Ertaga 10:00 (Toshkent)
    const tomorrow = new Date(Date.now() + 86_400_000 + 5 * 3_600_000).toISOString().slice(0, 10);
    await page.getByLabel("Yuborish vaqti").fill(`${tomorrow}T10:00`);
    await page.getByRole("button", { name: "Rejalashtirish", exact: true }).click();
    await expect(page.getByText("Rejalashtirildi.")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(`${TITLE} 2`) });
    await expect(row.getByText("Rejalashtirilgan")).toBeVisible();
    // Hali yuborilmagan — hech kimga xabar tushmagan
    expect(await withDb(async (db) => (await db.query(`SELECT count(*)::int AS n FROM "UserNotification" u JOIN "Notification" n ON n.id = u."notificationId" WHERE n.title = $1`, [`${TITLE} 2`])).rows[0].n)).toBe(0);

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Bekor qilish" }).click();
    await expect(row).toHaveCount(0);
  });

  test("cron manzili sirsiz 404; biznes egasi uchun xabarlar sahifasi", async ({ page, request }) => {
    expect((await request.get("/api/cron/bildirishnomalar")).status()).toBe(404);
    expect((await request.get("/api/cron/bildirishnomalar", { headers: { authorization: "Bearer noto'g'ri" } })).status()).toBe(404);
    await signIn(page, phones.owner);
    await page.goto("/biznes/bildirishnomalar");
    await expect(page.getByRole("heading", { level: 1, name: "Bildirishnomalar" })).toBeVisible();
  });
});
