import { expect, test } from "@playwright/test";
import { clearOtp, signIn, withDb } from "./helpers";

// Biznes egasi kirgach /biznes ariza holatiga qarab: yarim yo'lda/rad etilgan → forma, tekshiruvda → 3-qadam,
// tasdiqlangan → statistika. (Ro'yxatdan o'tgach tekshiruvga yuborish → /biznes — e2e/business-register.spec.ts.)
const OWNERS = {
  draft: "+998935550941",
  pending: "+998935550942",
  rejected: "+998935550943",
  approved: "+998935550944",
  warned: "+998935550945",
} as const;
const PHONES = Object.values(OWNERS);

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "Business" WHERE "ownerId" IN (SELECT id FROM "User" WHERE phone = ANY($1))`, [PHONES]);
    await db.query(`DELETE FROM "User" WHERE phone = ANY($1)`, [PHONES]);
  });
  for (const phone of PHONES) await clearOtp(phone);
}

async function makeOwner(phone: string, status: "PENDING" | "APPROVED" | "REJECTED" | "WARNED", submitted: boolean) {
  await withDb(async (db) => {
    const id = `home_${phone.slice(-3)}`;
    await db.query(`INSERT INTO "User" (id, phone, role, status, "firstName", "lastName", "updatedAt") VALUES ($1, $2, 'BUSINESS_OWNER', 'ACTIVE', 'Sinov', 'Egasi', now())`, [id, phone]);
    await db.query(
      `INSERT INTO "Business" (id, "ownerId", name, kind, address, "workingHours", status, "rejectReason", "submittedAt", "updatedAt")
       VALUES ($1, $2, $3, 'CAFE', 'Bunyodkor 1, Chilonzor', '09:00 – 22:00', $4::"BusinessStatus", $5, $6, now())`,
      [`${id}_b`, id, `Holat ${status}`, status, status === "REJECTED" ? "Guvohnoma o'qilmaydi" : null, submitted ? new Date() : null],
    );
  });
}

test.beforeEach(cleanup);
test.afterAll(cleanup);

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });

    test("tekshiruvdagi ariza → tekshiruv sahifasi", async ({ page }) => {
      await makeOwner(OWNERS.pending, "PENDING", true);
      await signIn(page, OWNERS.pending);
      await expect(page).toHaveURL("/biznes");
      await expect(page.getByTestId("business-stamp").locator("visible=true")).toHaveText("TEKSHIRUVDA");
    });

    test("yuborilmagan ariza → forma (davom ettirish)", async ({ page }) => {
      await makeOwner(OWNERS.draft, "PENDING", false);
      await signIn(page, OWNERS.draft);
      await expect(page).toHaveURL("/biznes");
      await expect(page.locator(viewport.width < 700 ? "#b1-name" : "#wb-name")).toHaveValue("Holat PENDING");
    });

    test("rad etilgan ariza → sabab bilan forma", async ({ page }) => {
      await makeOwner(OWNERS.rejected, "REJECTED", true);
      await signIn(page, OWNERS.rejected);
      await expect(page).toHaveURL("/biznes");
      await expect(page.getByText("Guvohnoma o'qilmaydi").locator("visible=true")).toBeVisible();
    });

    test("tasdiqlangan (yangi, sotuvsiz) → statistika, 'quriladi' emas", async ({ page }) => {
      await makeOwner(OWNERS.approved, "APPROVED", true);
      await signIn(page, OWNERS.approved);
      await expect(page).toHaveURL("/biznes");
      await expect(page.getByRole("heading", { name: "Statistika" }).locator("visible=true")).toBeVisible();
      await expect(page.getByText("quriladi")).toHaveCount(0);
      await expect(page.getByText("Hali sotuv yo'q.").locator("visible=true").first()).toBeVisible();
      // Sotuvlar sahifasi ham bo'sh holatda ochiladi
      await page.goto("/biznes/sotuvlar");
      await expect(page.getByText("Bu davrda sotuv yo'q.").locator("visible=true")).toBeVisible();
    });

    test("ogohlantirilgan (WARNED) biznes ham statistikani ko'radi", async ({ page }) => {
      await makeOwner(OWNERS.warned, "WARNED", true);
      await signIn(page, OWNERS.warned);
      await expect(page).toHaveURL("/biznes");
      await expect(page.getByRole("heading", { name: "Statistika" }).locator("visible=true")).toBeVisible();
    });
  });
}
