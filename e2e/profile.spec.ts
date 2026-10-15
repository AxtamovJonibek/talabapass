import { expect, test } from "@playwright/test";
import { seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

// T8 / WT4 — profil: karta, jami, tahrirlash (tuman), bildirishnoma kaliti, guvohnoma sahifasi
let phones: SeedPhones;
type Row = { firstName: string; lastName: string; faculty: string | null; course: string; districtId: string | null; notifyDeals: boolean };

const snapshot = (phone: string) =>
  withDb(async (db) => {
    const { rows } = await db.query<Row>(
      `SELECT u."firstName", u."lastName", p.faculty, p.course, p."districtId", p."notifyDeals" FROM "User" u JOIN "StudentProfile" p ON p."userId" = u.id WHERE u.phone = $1`,
      [phone],
    );
    return rows[0]!;
  });
const restore = (phone: string, s: Row) =>
  withDb(async (db) => {
    await db.query(`UPDATE "User" SET "firstName" = $2, "lastName" = $3 WHERE phone = $1`, [phone, s.firstName, s.lastName]);
    await db.query(
      `UPDATE "StudentProfile" SET faculty = $2, course = $3::"Course", "districtId" = $4, "notifyDeals" = $5 WHERE "userId" = (SELECT id FROM "User" WHERE phone = $1)`,
      [phone, s.faculty, s.course, s.districtId, s.notifyDeals],
    );
  });

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);
let before: Row;
test.beforeAll(async () => {
  phones = await seedPhones();
  before = await snapshot(phones.student);
});
test.afterAll(async () => {
  await restore(phones.student, before);
});

test("telefon: karta, jami va menyu; tahrirlash tumanni saqlaydi, kalit bildirishnomani almashtiradi", async ({ page }) => {
  await signIn(page, phones.student);
  await page.goto("/profil");
  await expect(page.getByRole("heading", { name: "Profil", exact: true }).locator("visible=true")).toBeVisible();
  await expect(page.getByText("Tasdiqlangan").locator("visible=true").first()).toBeVisible();
  await expect(page.getByText(/^ID TP-/).locator("visible=true")).toBeVisible();
  await expect(page.getByText("Jami tejaldi").locator("visible=true")).toBeVisible();

  // Bildirishnoma kaliti serverga yoziladi
  const toggle = page.locator("#notif");
  const was = (await toggle.getAttribute("aria-checked")) === "true";
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", String(!was));
  await expect.poll(async () => (await snapshot(phones.student)).notifyDeals).toBe(!was);

  // Shaxsiy ma'lumotlar: fakultet va tuman
  await page.getByRole("link", { name: "Shaxsiy ma'lumotlar" }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/profil\/tahrir$/);
  await page.locator("#p-faculty").fill("Profil sinovi");
  const district = page.locator("#p-districtId");
  const option = district.locator("option:not([value=''])").first();
  await district.selectOption(await option.getAttribute("value"));
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByTestId("profile-saved").locator("visible=true")).toBeVisible();
  const saved = await snapshot(phones.student);
  expect(saved.faculty).toBe("Profil sinovi");
  expect(saved.districtId).not.toBeNull();

  // Noto'g'ri ism — xato, bazada o'zgarmaydi
  await page.locator("#p-firstName").fill("1");
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByText("Harflardan iborat 2–40 belgi kiriting.").locator("visible=true").first()).toBeVisible();
  expect((await snapshot(phones.student)).firstName).toBe(before.firstName);

  // Tumanni olib tashlash mumkin
  await page.locator("#p-firstName").fill(before.firstName);
  await district.selectOption("");
  await page.getByRole("button", { name: "Saqlash" }).locator("visible=true").click();
  await expect(page.getByTestId("profile-saved").locator("visible=true")).toBeVisible();
  expect((await snapshot(phones.student)).districtId).toBeNull();
});

test("telefon: guvohnoma sahifasi amal muddatini ko'rsatadi", async ({ page }) => {
  await signIn(page, phones.student);
  await page.goto("/profil/guvohnoma");
  await expect(page.getByRole("heading", { name: "Talaba guvohnomasi" }).locator("visible=true")).toBeVisible();
  await expect(page.getByText("Amal qilish muddati").locator("visible=true")).toBeVisible();
  await expect(page.getByText(/^\d{2}\.\d{2}\.\d{4}$/).locator("visible=true")).toBeVisible();
});

test.describe("veb (WT4)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("yon panel va forma; tarix yon paneli bilan bir xil", async ({ page }) => {
    await signIn(page, phones.student);
    await page.goto("/profil");
    await expect(page.getByRole("heading", { name: "Shaxsiy ma'lumotlar" }).locator("visible=true")).toBeVisible();
    await expect(page.locator("#w-firstName")).toHaveValue(before.firstName);
    await expect(page.getByRole("link", { name: "Talaba guvohnomasi" }).locator("visible=true")).toBeVisible();
    await page.getByRole("link", { name: "Profil va tarix" }).locator("visible=true").click();
    await expect(page).toHaveURL(/\/tarix$/);
    await expect(page.getByText(/^ID TP-/).locator("visible=true")).toBeVisible();
    await expect(page.getByRole("link", { name: "Shaxsiy ma'lumotlar" }).locator("visible=true")).toBeVisible();
  });
});
