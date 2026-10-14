import { createHash } from "node:crypto";
import { networkInterfaces } from "node:os";
import { expect, test, type BrowserContext } from "@playwright/test";
import { withDb } from "./helpers";

// Kamera holatlari: jonli kamera (soxta qurilma), ruxsat berilmagan, http orqali ochilgan sahifa.
const PHONE = "+998905550821";

// Soxta kamera qurilmasi (rangli test tasviri). Ruxsat har bir guruhda kontekst darajasida beriladi yoki berilmaydi.
// "chromium" kanali — to'liq brauzer (headless-shell kamera API'sini umuman qo'llamaydi).
test.use({ channel: "chromium", launchOptions: { args: ["--use-fake-device-for-media-stream"] } });
const TOKEN = "e2e-camera-session";

async function draftStudentSession(context: BrowserContext, url: string) {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "User" WHERE phone = $1`, [PHONE]);
    const uni = (await db.query(`SELECT id FROM "University" LIMIT 1`)).rows[0].id;
    await db.query(`INSERT INTO "User" (id, phone, role, "firstName", "lastName", "updatedAt") VALUES ('e2e_camera', $1, 'STUDENT', 'Kamera', 'Sinov', now())`, [PHONE]);
    await db.query(`INSERT INTO "StudentProfile" ("userId", "universityId", course, "publicId", "updatedAt") VALUES ('e2e_camera', $1, 'C1', 'TP-E2E-CAM1', now())`, [uni]);
    await db.query(`INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt") VALUES ('e2e_camera_s', 'e2e_camera', $1, now() + interval '1 day')`, [
      createHash("sha256").update(TOKEN).digest("hex"),
    ]);
  });
  await context.addCookies([{ name: "tp_session", value: TOKEN, url }]);
}

test.afterAll(async () => {
  await withDb((db) => db.query(`DELETE FROM "User" WHERE phone = $1`, [PHONE]));
});

test.describe("jonli kamera bor", () => {
  test.use({ permissions: ["camera"] });

  test("ramkada jonli tasvir, tugma kadrni olib yuklaydi", async ({ page, context, baseURL }) => {
    await draftStudentSession(context, baseURL!);
    await page.goto("/talaba/guvohnoma", { waitUntil: "networkidle" });
    const video = page.locator("video").locator("visible=true");
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    await expect(page.getByTestId("camera-issue")).toHaveCount(0);

    await page.getByRole("button", { name: "Rasmga olish" }).click();
    await expect(page).toHaveURL("/talaba/tekshiruv");
    const stored = await withDb(async (db) => (await db.query(`SELECT mime, "fileSize" FROM "Verification" WHERE "studentId" = 'e2e_camera'`)).rows[0]);
    expect(stored.mime).toBe("image/jpeg");
    expect(stored.fileSize).toBeGreaterThan(1000);
  });
});

test.describe("kameraga ruxsat berilmagan", () => {
  // Ruxsat berilmagan: headless brauzer so'rovni rad etadi
  test.use({ permissions: [] });

  test("tushunarli xabar chiqadi, fayl tanlash ishlaydi", async ({ page, context, baseURL }) => {
    await draftStudentSession(context, baseURL!);
    await page.goto("/talaba/guvohnoma", { waitUntil: "networkidle" });
    await expect(page.getByTestId("camera-issue")).toContainText("Kameraga ruxsat berilmadi");
    await expect(page.getByRole("button", { name: "Fayl" })).toBeEnabled();
  });
});

test.describe("http orqali (telefondan lokal IP bilan)", () => {
  const lanIp = Object.values(networkInterfaces())
    .flat()
    .find((a) => a && a.family === "IPv4" && !a.internal)?.address;

  test("brauzer kamerani bermaydi — sababi va boshqa yo'li tushuntiriladi", async ({ page, context }) => {
    test.skip(!lanIp, "Kompyuterda lokal tarmoq manzili yo'q");
    const origin = `http://${lanIp}:${process.env.E2E_PORT ?? 3000}`;
    await draftStudentSession(context, origin);
    await page.goto(`${origin}/talaba/guvohnoma`, { waitUntil: "networkidle" });
    expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
    await expect(page.getByTestId("camera-issue")).toContainText("xavfsiz (https)");
    // Oq tugma bu holatda telefonning o'z kamera ilovasini ochadigan fayl maydonini ishga tushiradi
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Rasmga olish" }).click();
    expect((await chooser).isMultiple()).toBe(false);
  });
});
