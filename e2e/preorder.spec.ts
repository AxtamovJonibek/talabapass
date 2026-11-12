import { expect, test, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb } from "./helpers";

// Oldindan band qilish: talaba band qiladi (soxta to'lov) → biznes qabul qiladi → tayyor → kassir skanerlaydi → BERILDI.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const TITLE = "Osh 0.5 porsiya + ko'k choy";
let businessId: string;
let discountId: string;

test.beforeAll(async () => {
  await withDb(async (db) => {
    const { rows } = await db.query<{ id: string; businessId: string }>(`SELECT d.id, d."businessId" FROM "Discount" d WHERE d.title = $1`, [TITLE]);
    discountId = rows[0]!.id;
    businessId = rows[0]!.businessId;
    await db.query(`DELETE FROM "Order" WHERE "businessId" = $1`, [businessId]);
    await db.query(`DELETE FROM "PreorderSlot" WHERE "businessId" = $1`, [businessId]);
    // Har kuni kun bo'yi, tayyorlash vaqtisiz — test qachon yurmasin slot bo'lsin; qo'lda tasdiqlash
    await db.query(
      `INSERT INTO "PreorderSettings" ("businessId", enabled, mode, schedule, "slotMinutes", "slotCapacity", "leadMinutes", "daysAhead", prepay, "freeCancelMinutes", "keepPercent", "autoConfirm", "updatedAt")
       VALUES ($1, true, 'BOTH', $2::jsonb, 60, 10, 0, 1, 'FULL', 60, 50, false, now())
       ON CONFLICT ("businessId") DO UPDATE SET enabled = true, mode = 'BOTH', schedule = EXCLUDED.schedule, "slotMinutes" = 60, "slotCapacity" = 10,
         "leadMinutes" = 0, "daysAhead" = 1, prepay = 'FULL', "autoConfirm" = false, "pausedOn" = NULL`,
      [businessId, JSON.stringify([1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 0, to: 1440 })))],
    );
    await db.query(`UPDATE "Discount" SET preorder = true WHERE id = $1`, [discountId]);
  });
});

test.afterAll(async () => {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "Order" WHERE "businessId" = $1`, [businessId]);
    await db.query(`DELETE FROM "PreorderSlot" WHERE "businessId" = $1`, [businessId]);
    await db.query(`DELETE FROM "PreorderSettings" WHERE "businessId" = $1`, [businessId]);
    await db.query(`UPDATE "Discount" SET preorder = false WHERE id = $1`, [discountId]);
  });
});

const sheet = (page: Page) => page.getByTestId("booking-sheet");

test("talaba band qiladi → biznes qabul qiladi → tayyor → kassir skanerlaydi → BERILDI", async ({ browser }) => {
  const phones = await seedPhones();
  const student = await (await browser.newContext()).newPage();
  await signIn(student, phones.student);

  // 1) Band qilish: usul → kun → vaqt → soni → telefon (profildan) → narx va qoida → to'lov
  await student.goto(`/chegirmalar/${discountId}`);
  await student.getByTestId("booking-open").locator("visible=true").click();
  await sheet(student).getByRole("button", { name: /Olib ketaman/ }).click();
  await sheet(student).locator("button[aria-pressed]:not([disabled])").first().click(); // birinchi bo'sh kun
  await sheet(student).getByRole("radiogroup").locator("button:not([disabled])").first().click(); // birinchi bo'sh slot
  await sheet(student).getByRole("button", { name: "Ko'paytirish" }).click();
  await expect(sheet(student).getByTestId("booking-quantity")).toHaveText("2");
  await sheet(student).locator("#booking-note").fill("Piyozsiz");
  await sheet(student).getByRole("button", { name: "Keyingi" }).click();
  await expect(sheet(student).locator("#booking-phone")).not.toHaveValue("");
  await sheet(student).getByRole("button", { name: "Keyingi" }).click();
  // 38 000 −30% = 26 600 × 2
  await expect(sheet(student).getByTestId("booking-pay-now")).toHaveText("53 200");
  await expect(sheet(student).getByText("Bekor qilish qoidasi")).toBeVisible();
  await sheet(student).getByTestId("booking-submit").click();

  // 2) Soxta to'lov sahifasi
  await student.waitForURL(/\/test-tolov\//);
  await expect(student.getByTestId("mock-amount")).toContainText("53 200");
  await student.getByTestId("mock-success").click();
  await student.waitForURL(/\/buyurtmalar\/[a-z0-9]+$/);
  await expect(student.getByTestId("order-status").first()).toHaveText("To'landi");
  const orderUrl = student.url();

  // 3) Biznes: yangi buyurtma → qabul qilish → tayyor
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, phones.owner);
  await owner.goto("/biznes/buyurtmalar");
  const card = owner.getByTestId("order-card").filter({ hasText: TITLE });
  await expect(card).toContainText("× 2");
  await expect(card).toContainText("Piyozsiz");
  await card.getByRole("button", { name: "Qabul qilish" }).click();
  await owner.getByRole("tab", { name: /Tayyorlanmoqda/ }).click();
  await owner.getByTestId("order-card").filter({ hasText: TITLE }).getByRole("button", { name: "Tayyor" }).click();
  await owner.getByRole("tab", { name: /^Tayyor\d*$/ }).click();
  await expect(owner.getByTestId("order-card").filter({ hasText: TITLE })).toContainText("Tayyor");

  // 4) Talaba ekranida QR, kod va 6 raqam
  await student.goto(orderUrl);
  await expect(student.getByTestId("order-status").first()).toHaveText("Tayyor");
  const code = (await student.getByTestId("order-code").textContent())!.trim();
  await expect(student.getByTestId("order-totp")).toHaveText(/^\d{6}$/);
  const totp = (await student.getByTestId("order-totp").textContent())!.trim();

  // 5) Kassir: qo'lda kiritish → buyurtma tafsiloti → "Berildi"
  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, phones.cashier);
  await cashier.goto("/biznes/skaner");
  await cashier.getByRole("button", { name: "Kodni kiritish" }).click();
  await cashier.locator("#manual-code").fill(code);
  await cashier.locator("#manual-totp").fill(totp);
  await cashier.getByRole("button", { name: "Tekshirish" }).click();
  const preview = cashier.getByTestId("order-preview");
  await expect(preview).toContainText(TITLE);
  await expect(cashier.getByTestId("order-quantity")).toContainText("2");
  await expect(preview).toContainText("Piyozsiz");
  await cashier.getByRole("button", { name: "Berildi" }).click();
  await expect(cashier.getByTestId("order-done")).toBeVisible();

  // 6) Talaba: BERILDI, vaqt chizig'ida butun yo'l
  await student.reload();
  await expect(student.getByTestId("order-status").first()).toHaveText("Berildi");
  await expect(student.getByTestId("order-timeline")).toContainText("To'landi");
  await expect(student.getByTestId("order-timeline")).toContainText("Tasdiqlandi");
  await expect(student.getByTestId("order-timeline")).toContainText("Berildi");
  const status = await withDb(async (db) => (await db.query<{ status: string; captured: number }>(`SELECT o.status, p.captured FROM "Order" o JOIN "Payment" p ON p."orderId" = o.id WHERE o.code = $1`, [code])).rows[0]);
  expect(status).toEqual({ status: "COMPLETED", captured: 53_200 });
});

test("funksiya o'chiq bo'lsa \"Band qilish\" umuman ko'rinmaydi", async ({ page }) => {
  await withDb((db) => db.query(`UPDATE "PreorderSettings" SET enabled = false WHERE "businessId" = $1`, [businessId]));
  await signIn(page, (await seedPhones()).student);
  await page.goto(`/chegirmalar/${discountId}`);
  await expect(page.getByRole("heading", { name: TITLE }).locator("visible=true")).toBeVisible();
  await expect(page.getByTestId("booking-open")).toHaveCount(0);
  await expect(page.getByText("Band qilish")).toHaveCount(0);
});
