-- ───────── Kupon: olingan paytdagi shartlar (snapshot) ─────────
-- Avval bo'sh ustunlar, mavjud kuponlar uchun to'ldiriladi, so'ng majburiy qilinadi.
ALTER TABLE "Coupon"
  ADD COLUMN "termsTitle" TEXT,
  ADD COLUMN "termsType" "DiscountType",
  ADD COLUMN "termsPercent" INTEGER,
  ADD COLUMN "termsOriginalPrice" INTEGER,
  ADD COLUMN "termsDiscountAmount" INTEGER,
  ADD COLUMN "termsFinalPrice" INTEGER,
  ADD COLUMN "termsNote" TEXT;

-- Sotilgan kuponlar: haqiqiy summalar chekdan; qolganlari — chegirmaning hozirgi shartlaridan.
UPDATE "Coupon" c SET
  "termsTitle" = d.title,
  "termsType" = d.type,
  "termsPercent" = d.percent,
  "termsNote" = d.note,
  "termsOriginalPrice" = COALESCE(r."originalPrice", d."originalPrice"),
  "termsDiscountAmount" = COALESCE(r."discountAmount", CASE
    WHEN d.type = 'FIXED_PRICE' THEN d."originalPrice" - d."newPrice"
    WHEN d.type = 'PERCENT' AND d."originalPrice" IS NOT NULL THEN d."originalPrice" - (ROUND(d."originalPrice" * (100 - d.percent) / 100.0 / 100) * 100)::int
    ELSE NULL END),
  "termsFinalPrice" = COALESCE(r."paidAmount", CASE
    WHEN d.type = 'FIXED_PRICE' THEN d."newPrice"
    WHEN d.type = 'PERCENT' AND d."originalPrice" IS NOT NULL THEN (ROUND(d."originalPrice" * (100 - d.percent) / 100.0 / 100) * 100)::int
    ELSE NULL END)
FROM "Discount" d
LEFT JOIN "Redemption" r ON FALSE
WHERE d.id = c."discountId";

UPDATE "Coupon" c SET
  "termsOriginalPrice" = r."originalPrice",
  "termsDiscountAmount" = r."discountAmount",
  "termsFinalPrice" = r."paidAmount"
FROM "Redemption" r
WHERE r."couponId" = c.id;

ALTER TABLE "Coupon"
  ALTER COLUMN "termsTitle" SET NOT NULL,
  ALTER COLUMN "termsType" SET NOT NULL;

-- ───────── Chegirma vaqt oralig'i yarim tundan o'tishi mumkin (22:00–02:00) ─────────
ALTER TABLE "Discount" DROP CONSTRAINT "Discount_window_check";
ALTER TABLE "Discount"
  ADD CONSTRAINT "Discount_window_check"
  CHECK ("fromMinute" BETWEEN 0 AND 1439 AND "toMinute" BETWEEN 1 AND 1440 AND "fromMinute" <> "toMinute");

-- Foiz 5–90, yangi narx asl narxdan kichik (server tekshiruvining bazadagi zaxirasi)
ALTER TABLE "Discount" DROP CONSTRAINT "Discount_percent_check";
ALTER TABLE "Discount"
  ADD CONSTRAINT "Discount_percent_check" CHECK ("percent" IS NULL OR "percent" BETWEEN 5 AND 90),
  ADD CONSTRAINT "Discount_price_check" CHECK ("newPrice" IS NULL OR "originalPrice" IS NULL OR ("newPrice" > 0 AND "newPrice" < "originalPrice"));
