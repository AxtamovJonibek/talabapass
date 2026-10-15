import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { qrToken, windowAt } from "../src/lib/totp";
import { seedPhones, signIn, withDb } from "./helpers";

// B3: haqiqiy kamera oqimi — Chromium'ga soxta video (talaba QR'i tushirilgan kadr) beriladi, skaner uni o'qiydi.
const DISCOUNT_ID = "e2ecameraflow01";
const COUPON_ID = "e2ecameracoupon01";
const CODE = "TP-CAMR-2E2E";

async function cleanup() {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "ScanAttempt" WHERE "couponId" = $1`, [COUPON_ID]);
    await db.query(`DELETE FROM "Redemption" WHERE "couponId" = $1`, [COUPON_ID]);
    await db.query(`DELETE FROM "Coupon" WHERE id = $1`, [COUPON_ID]);
    await db.query(`DELETE FROM "Discount" WHERE id = $1`, [DISCOUNT_ID]);
  });
}
test.afterAll(cleanup);

/** Server bilan bir xil shifrlash (src/server/coupons/coupons.ts): AES-256-GCM, kalit AUTH_SECRET dan. */
function encryptSecret(secret: Buffer): Buffer {
  const key = createHash("sha256").update(`tp-coupon-secret:${process.env.AUTH_SECRET}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]);
}

/** QR'ni oq fondagi 640×480 kadrga chizib, bitta kadrli Y4M (I420) fayl yaratadi. */
function qrVideo(text: string): string {
  const W = 640;
  const H = 480;
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const cell = Math.floor(360 / (modules.size + 8));
  const offX = Math.floor((W - modules.size * cell) / 2);
  const offY = Math.floor((H - modules.size * cell) / 2);
  const y = Buffer.alloc(W * H, 235);
  for (let r = 0; r < modules.size; r++) {
    for (let c = 0; c < modules.size; c++) {
      if (!modules.data[r * modules.size + c]) continue;
      for (let dy = 0; dy < cell; dy++) y.fill(16, (offY + r * cell + dy) * W + offX + c * cell, (offY + r * cell + dy) * W + offX + (c + 1) * cell);
    }
  }
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const file = join(mkdtempSync(join(tmpdir(), "tp-qr-")), "qr.y4m");
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\nFRAME\n`), y, chroma]));
  return file;
}

test("kassir kamerada talaba QR'ini o'qiydi va B4 ochiladi", async () => {
  test.slow();
  await cleanup();
  const phones = await seedPhones();
  const secret = randomBytes(20);
  await withDb(async (db) => {
    await db.query(
      `INSERT INTO "Discount" (id, "businessId", "categoryId", title, type, "originalPrice", percent, weekdays, "fromMinute", "toMinute", "dailyLimit", "perStudentLimit", "startsOn", "endsOn", status, "updatedAt")
       SELECT $1, m."businessId", (SELECT id FROM "Category" WHERE slug = 'taom'), 'E2E kamera', 'PERCENT', 38000, 30, '{1,2,3,4,5,6,7}', 0, 1440, 100, 'UNLIMITED',
              current_date - 1, current_date + 5, 'ACTIVE', now()
       FROM "BusinessMember" m JOIN "User" u ON u.id = m."userId" WHERE u.phone = $2 AND m.active LIMIT 1`,
      [DISCOUNT_ID, phones.cashier],
    );
    await db.query(
      `INSERT INTO "Coupon" (id, code, "discountId", "studentId", date, status, secret, "expiresAt", "termsTitle", "termsType", "termsPercent", "termsOriginalPrice", "termsDiscountAmount", "termsFinalPrice")
       SELECT $1, $2, $3, u.id, (now() AT TIME ZONE 'Asia/Tashkent')::date, 'ACTIVE', $4, now() + interval '10 minutes', 'E2E kamera', 'PERCENT', 30, 38000, 11400, 26600
       FROM "User" u WHERE u.phone = $5`,
      [COUPON_ID, CODE, DISCOUNT_ID, encryptSecret(secret), phones.student],
    );
    await db.query(
      `INSERT INTO "DiscountDay" ("discountId", date, claimed, redeemed) VALUES ($1, (now() AT TIME ZONE 'Asia/Tashkent')::date, 1, 0)
       ON CONFLICT ("discountId", date) DO UPDATE SET claimed = "DiscountDay".claimed + 1`,
      [DISCOUNT_ID],
    );
  });

  const video = qrVideo(await qrToken(CODE, new Uint8Array(secret), windowAt(Date.now())));
  // To'liq Chromium (headless-shell kamerani qo'llamaydi), soxta kamera — shu fayl
  const browser = await chromium.launch({
    channel: "chromium",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${video}`],
  });
  try {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 390, height: 844 }, permissions: ["camera"] });
    const page = await context.newPage();
    await signIn(page, phones.cashier);
    await expect(page).toHaveURL("/biznes/skaner");
    await expect(page.getByText("QR haqiqiy")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(CODE)).toBeVisible();
    await expect(page.getByTestId("sale-total")).toHaveText("26 600");
  } finally {
    await browser.close();
  }
});
