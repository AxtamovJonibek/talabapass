import { expect, test, type Browser, type Page } from "@playwright/test";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

// Oldindan band qilish, uch rejim: band qilish/to'lash (soxta to'lov) → biznes qabul qiladi → (tayyor) → kassir skanerlaydi → BERILDI.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const TITLE = "Osh 0.5 porsiya + ko'k choy";
let businessId: string;
let discountId: string;
let weekdays: number[];
let phones: SeedPhones;

const resetOrders = () =>
  withDb(async (db) => {
    await db.query(`DELETE FROM "Order" WHERE "businessId" = $1`, [businessId]);
    await db.query(`DELETE FROM "BookingSeat" WHERE "discountId" = $1`, [discountId]);
  });

/** Chegirma rejimi (qolgan maydonlar standart) */
const setMode = (mode: string, fields: Record<string, number> = {}) =>
  withDb((db) => {
    const all = { serviceMinutes: 30, staffCount: 2, stock: 0, validDays: 7, perStudentMax: 10, expireKeepPercent: 0, windowFrom: 720, windowTo: 900, windowCapacity: 10, ...fields };
    const sets = Object.keys(all).map((k, i) => `"${k}" = $${i + 3}`);
    return db.query(`UPDATE "Discount" SET "bookingMode" = $2, ${sets.join(", ")} WHERE id = $1`, [discountId, mode, ...Object.values(all)]);
  });

test.beforeAll(async () => {
  phones = await seedPhones();
  await withDb(async (db) => {
    const { rows } = await db.query<{ id: string; businessId: string; weekdays: number[] }>(`SELECT d.id, d."businessId", d.weekdays FROM "Discount" d WHERE d.title = $1`, [TITLE]);
    discountId = rows[0]!.id;
    businessId = rows[0]!.businessId;
    weekdays = rows[0]!.weekdays;
    // Har kuni kun bo'yi, tayyorlash vaqtisiz — test qachon yurmasin slot bo'lsin; qo'lda tasdiqlash
    await db.query(
      `INSERT INTO "PreorderSettings" ("businessId", enabled, schedule, "leadMinutes", "daysAhead", prepay, "freeCancelMinutes", "keepPercent", "autoConfirm", "updatedAt")
       VALUES ($1, true, $2::jsonb, 0, 1, 'FULL', 60, 50, false, now())
       ON CONFLICT ("businessId") DO UPDATE SET enabled = true, schedule = EXCLUDED.schedule, "leadMinutes" = 0, "daysAhead" = 1, prepay = 'FULL', "autoConfirm" = false, "pausedOn" = NULL`,
      [businessId, JSON.stringify([1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, from: 0, to: 1440 })))],
    );
    // Chegirma har kuni (seed'da Du–Ju) — slot/oyna chegirma soatlari (12:00–15:00) ichida bo'lishi shart, test dam olish kunida ham yursin
    await db.query(`UPDATE "Discount" SET weekdays = '{1,2,3,4,5,6,7}' WHERE id = $1`, [discountId]);
  });
  await resetOrders();
});

test.afterAll(async () => {
  await resetOrders();
  await withDb(async (db) => {
    await db.query(`DELETE FROM "PreorderSettings" WHERE "businessId" = $1`, [businessId]);
    await db.query(`UPDATE "Discount" SET stock = 0, weekdays = $2 WHERE id = $1`, [discountId, weekdays]);
    await db.query(`UPDATE "Discount" SET "bookingMode" = 'NONE' WHERE "businessId" = $1`, [businessId]);
  });
});

const sheet = (page: Page) => page.getByTestId("booking-sheet");

async function openSheet(browser: Browser, button: string): Promise<Page> {
  const student = await (await browser.newContext()).newPage();
  await signIn(student, phones.student);
  await student.goto(`/uz/chegirmalar/${discountId}`);
  // Dev serverdagi Next.js belgisi ("Insight") oyna pastidagi tugmani to'sadi
  await student.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const open = student.getByTestId("booking-open").locator("visible=true");
  await expect(open).toHaveText(button);
  await open.click();
  return student;
}

/** Tafsilot: soni, izoh, telefon (profildan) → yakun */
async function details(student: Page, note: string, quantity: number) {
  for (let i = 1; i < quantity; i++) await sheet(student).getByRole("button", { name: "Ko'paytirish" }).click();
  if (quantity > 1) await expect(sheet(student).getByTestId("booking-quantity")).toHaveText(String(quantity));
  await sheet(student).locator("#booking-note").fill(note);
  await expect(sheet(student).locator("#booking-phone")).not.toHaveValue("");
  await sheet(student).getByRole("button", { name: "Keyingi" }).click();
}

/** Yakun → soxta to'lov → buyurtma sahifasi ("To'landi"); buyurtma manzili */
async function pay(student: Page, amount: string): Promise<string> {
  await expect(sheet(student).getByTestId("booking-pay-now")).toHaveText(amount);
  await expect(sheet(student).getByTestId("booking-rules")).toBeVisible();
  await sheet(student).getByTestId("booking-submit").click();
  await student.waitForURL(/\/test-tolov\//);
  await expect(student.getByTestId("mock-amount")).toContainText(amount);
  await student.getByTestId("mock-success").click();
  await student.waitForURL(/\/buyurtmalar\/[a-z0-9]+$/);
  await expect(student.getByTestId("order-status").first()).toHaveText("To'landi");
  return student.url();
}

/** Biznes: yangi buyurtma → qabul qilish (→ tayyor) */
async function ownerAccepts(browser: Browser, expectText: string[], ready: boolean) {
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, phones.owner);
  await owner.goto("/uz/biznes/buyurtmalar");
  const card = owner.getByTestId("order-card").filter({ hasText: TITLE });
  for (const text of expectText) await expect(card).toContainText(text);
  await card.getByRole("button", { name: "Qabul qilish" }).click();
  await owner.getByRole("tab", { name: /Tayyorlanmoqda/ }).click();
  if (!ready) return expect(owner.getByTestId("order-card").filter({ hasText: TITLE })).toBeVisible();
  await owner.getByTestId("order-card").filter({ hasText: TITLE }).getByRole("button", { name: "Tayyor" }).click();
  await owner.getByRole("tab", { name: /^Tayyor\d*$/ }).click();
  await expect(owner.getByTestId("order-card").filter({ hasText: TITLE })).toContainText("Tayyor");
}

/** Talaba sahifasidagi kod + 6 raqam → kassir qo'lda kiritadi → tafsilot → "Berildi"; talabada BERILDI */
async function cashierGives(browser: Browser, student: Page, orderUrl: string, expectPreview: string[]) {
  await student.goto(orderUrl);
  const code = (await student.getByTestId("order-code").textContent())!.trim();
  await expect(student.getByTestId("order-totp")).toHaveText(/^\d{6}$/);
  const totp = (await student.getByTestId("order-totp").textContent())!.trim();

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, phones.cashier);
  await cashier.goto("/uz/biznes/skaner");
  await cashier.getByRole("button", { name: "Kodni kiritish" }).click();
  await cashier.locator("#manual-code").fill(code);
  await cashier.locator("#manual-totp").fill(totp);
  await cashier.getByRole("button", { name: "Tekshirish" }).click();
  const preview = cashier.getByTestId("order-preview");
  await expect(preview).toContainText(TITLE);
  for (const text of expectPreview) await expect(preview).toContainText(text);
  await cashier.getByRole("button", { name: "Berildi" }).click();
  await expect(cashier.getByTestId("order-done")).toBeVisible();

  await student.reload();
  await expect(student.getByTestId("order-status").first()).toHaveText("Berildi");
  await expect(student.getByTestId("order-timeline")).toContainText("Tasdiqlandi");
  return code;
}

const orderRow = (code: string) =>
  withDb(async (db) => (await db.query<{ status: string; kind: string; captured: number }>(`SELECT o.status, o.kind, p.captured FROM "Order" o JOIN "Payment" p ON p."orderId" = o.id WHERE o.code = $1`, [code])).rows[0]);

test("vaqtli uchrashuv: kun → vaqt → to'lov → biznes qabul qiladi → tayyor → kassir → BERILDI", async ({ browser }) => {
  await setMode("APPOINTMENT", { serviceMinutes: 30, staffCount: 2 });
  const student = await openSheet(browser, "Vaqt band qilish");
  await sheet(student).locator("button[aria-pressed]:not([disabled])").first().click(); // birinchi bo'sh kun
  const slot = sheet(student).getByRole("radiogroup").locator("button:not([disabled])").first();
  await expect(slot).toContainText("2 ta joy");
  await slot.click();
  await expect(sheet(student).getByTestId("booking-quantity")).toHaveCount(0); // uchrashuv — bitta joy
  await details(student, "Soqol ham", 1);
  // 30 daqiqalik slot: "…, 12:00–12:30" kabi
  await expect(sheet(student).getByTestId("booking-when")).toHaveText(/(\d{2}):(\d{2})–\d{2}:\d{2}/);
  const orderUrl = await pay(student, "26 600");

  await ownerAccepts(browser, ["Soqol ham", "Vaqtli uchrashuv"], true);
  const code = await cashierGives(browser, student, orderUrl, ["Vaqtli uchrashuv"]);
  expect(await orderRow(code)).toEqual({ status: "COMPLETED", kind: "APPOINTMENT", captured: 26_600 });
});

test("to'lab olib ketish: biznes rejimni tanlaydi → talaba 2 dona to'laydi → qabul → kassir → BERILDI, zaxira kamayadi", async ({ browser }) => {
  await setMode("NONE");
  // Biznes: Sozlamalar → chegirma → "To'lab olib ketish" kartasi, zaxira 5, muddat 7 kun, muddat o'tsa 50% qoladi
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, phones.owner);
  await owner.goto("/uz/biznes/sozlamalar");
  const row = owner.getByTestId("preorder-discount").filter({ hasText: TITLE }).locator("visible=true");
  if ((await row.getByTestId("booking-editor").count()) === 0) await row.getByRole("button", { name: "Sozlash" }).click();
  const editor = row.getByTestId("booking-editor");
  await editor.getByTestId("kind-PREPAID_PICKUP").click();
  await expect(editor.getByLabel("Xizmat davomiyligi, daqiqa")).toHaveCount(0); // faqat tanlangan rejim maydonlari
  await editor.getByLabel("Zaxira, dona").fill("5");
  await editor.getByLabel("Amal qilish muddati, kun").fill("7");
  await editor.getByRole("radio", { name: "Qismi qoladi" }).click();
  await editor.getByLabel("Sizda qoladigan ulush, %").fill("50");
  await expect(owner.getByTestId("booking-preview").locator("visible=true")).toContainText("Oldindan to'lash");
  await editor.getByTestId("booking-editor-save").click();
  await expect
    .poll(() => withDb(async (db) => (await db.query(`SELECT "bookingMode", stock, "validDays", "expireKeepPercent" FROM "Discount" WHERE id = $1`, [discountId])).rows[0]))
    .toEqual({ bookingMode: "PREPAID_PICKUP", stock: 5, validDays: 7, expireKeepPercent: 50 });

  const student = await openSheet(browser, "Oldindan to'lash");
  await details(student, "Qadoqlab bering", 2);
  await expect(sheet(student).getByTestId("booking-when")).toContainText("(7 kun)");
  await expect(sheet(student).getByTestId("booking-rules")).toContainText("50%");
  const orderUrl = await pay(student, "53 200");
  await expect(student.getByTestId("order-when")).toContainText("gacha");
  expect(await withDb(async (db) => (await db.query(`SELECT stock FROM "Discount" WHERE id = $1`, [discountId])).rows[0].stock)).toBe(3);

  await ownerAccepts(browser, ["× 2", "Qadoqlab bering", "To'lab olib ketish"], false);
  const code = await cashierGives(browser, student, orderUrl, ["To'lab olib ketish", "Olib ketish muddati"]);
  expect(await orderRow(code)).toEqual({ status: "COMPLETED", kind: "PREPAID_PICKUP", captured: 53_200 });
});

test("olib ketish oynasi: kun (oyna) → soni → to'lov → qabul → tayyor → kassir → BERILDI", async ({ browser }) => {
  await setMode("PICKUP_WINDOW", { windowFrom: 720, windowTo: 900, windowCapacity: 10 });
  const student = await openSheet(browser, "Olib ketishga buyurtma");
  const day = sheet(student).getByRole("radiogroup").locator("button:not([disabled])").first();
  await expect(day).toContainText("12:00–15:00");
  await day.click();
  await details(student, "Piyozsiz", 2);
  await expect(sheet(student).getByTestId("booking-when")).toContainText("12:00–15:00 oralig'ida");
  const orderUrl = await pay(student, "53 200");

  await ownerAccepts(browser, ["× 2", "Piyozsiz", "Olib ketish oynasi"], true);
  const code = await cashierGives(browser, student, orderUrl, ["Olib ketish oynasi", "12:00–15:00"]);
  expect(await orderRow(code)).toEqual({ status: "COMPLETED", kind: "PICKUP_WINDOW", captured: 53_200 });
});

test("funksiya o'chiq bo'lsa band qilish tugmasi umuman ko'rinmaydi", async ({ page }) => {
  await setMode("APPOINTMENT");
  await withDb((db) => db.query(`UPDATE "PreorderSettings" SET enabled = false WHERE "businessId" = $1`, [businessId]));
  await signIn(page, phones.student);
  await page.goto(`/uz/chegirmalar/${discountId}`);
  await expect(page.getByRole("heading", { name: TITLE }).locator("visible=true")).toBeVisible();
  await expect(page.getByTestId("booking-open")).toHaveCount(0);
  await expect(page.getByTestId("booking-blocked")).toHaveCount(0);
});

test("hozir band qilib bo'lmasa — tugma o'chiq, ostida sababi; zaxira tugasa — \"Zaxira tugadi\"; egasi rejimsiz chegirma haqida ogohlantiriladi", async ({ browser }) => {
  await setMode("APPOINTMENT");
  // Bugun to'xtatilgan, ertaga band qilinmaydi — talabaga "Biznes bugun ... qabul qilmayapti"
  await withDb((db) =>
    db.query(
      `UPDATE "PreorderSettings" SET enabled = true, "daysAhead" = 0, "pausedOn" = (now() AT TIME ZONE 'Asia/Tashkent')::date WHERE "businessId" = $1`,
      [businessId],
    ),
  );
  const student = await (await browser.newContext()).newPage();
  await signIn(student, phones.student);
  await student.goto(`/uz/chegirmalar/${discountId}`);
  const blocked = student.getByTestId("booking-blocked").locator("visible=true");
  await expect(blocked).toHaveText("Biznes bugun oldindan buyurtma qabul qilmayapti.");
  await expect(student.getByRole("button", { name: "Vaqt band qilish" }).locator("visible=true")).toBeDisabled();
  await expect(student.getByTestId("booking-open")).toHaveCount(0);

  await withDb((db) => db.query(`UPDATE "PreorderSettings" SET "pausedOn" = NULL WHERE "businessId" = $1`, [businessId]));
  await setMode("PREPAID_PICKUP", { stock: 0 });
  await student.reload();
  await expect(blocked).toHaveText("Zaxira tugadi.");
  await expect(student.getByRole("button", { name: "Oldindan to'lash" }).locator("visible=true")).toBeDisabled();

  // Egasi: hech bir chegirmada rejim yo'q — sozlamalarda ogohlantirish, talabada tugma umuman yo'q
  await withDb((db) => db.query(`UPDATE "Discount" SET "bookingMode" = 'NONE' WHERE "businessId" = $1`, [businessId]));
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, phones.owner);
  await owner.goto("/uz/biznes/sozlamalar");
  await expect(owner.getByTestId("preorder-none-marked").locator("visible=true")).toBeVisible();
  await student.reload();
  await expect(student.getByTestId("booking-blocked")).toHaveCount(0);
  await expect(student.getByTestId("booking-open")).toHaveCount(0);
});
