-- Universal band qilish: chegirma darajasida rejim (vaqtli uchrashuv, to'lab olib ketish, kunlik oyna).
-- Mavjud ma'lumot saqlanadi: belgilangan chegirmalar APPOINTMENT bo'ladi (slot uzunligi va sig'im biznes sozlamasidan),
-- eski buyurtmalar APPOINTMENT, band qilingan joylar chegirma bo'yicha qayta hisoblanadi.

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('NONE', 'APPOINTMENT', 'PREPAID_PICKUP', 'PICKUP_WINDOW');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'EXPIRED';

-- Discount: rejim va uning maydonlari
ALTER TABLE "Discount"
  ADD COLUMN "bookingMode" "BookingMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "serviceMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "staffCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "validDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "perStudentMax" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "expireKeepPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "windowFrom" INTEGER NOT NULL DEFAULT 840,
  ADD COLUMN "windowTo" INTEGER NOT NULL DEFAULT 1200,
  ADD COLUMN "windowCapacity" INTEGER NOT NULL DEFAULT 20;

UPDATE "Discount" d
SET "bookingMode" = 'APPOINTMENT',
    "serviceMinutes" = COALESCE((SELECT s."slotMinutes" FROM "PreorderSettings" s WHERE s."businessId" = d."businessId"), 30),
    "staffCount" = LEAST(GREATEST(COALESCE((SELECT s."slotCapacity" FROM "PreorderSettings" s WHERE s."businessId" = d."businessId"), 1), 1), 20)
WHERE d.preorder = true;

ALTER TABLE "Discount" DROP COLUMN "preorder";

ALTER TABLE "Discount"
  ADD CONSTRAINT "Discount_serviceMinutes_check" CHECK ("serviceMinutes" BETWEEN 5 AND 480),
  ADD CONSTRAINT "Discount_staffCount_check" CHECK ("staffCount" BETWEEN 1 AND 20),
  ADD CONSTRAINT "Discount_validDays_check" CHECK ("validDays" BETWEEN 1 AND 60),
  ADD CONSTRAINT "Discount_stock_check" CHECK ("stock" >= 0),
  ADD CONSTRAINT "Discount_perStudentMax_check" CHECK ("perStudentMax" BETWEEN 1 AND 20),
  ADD CONSTRAINT "Discount_expireKeepPercent_check" CHECK ("expireKeepPercent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "Discount_pickupWindow_check" CHECK ("windowFrom" >= 0 AND "windowTo" <= 1440 AND "windowTo" > "windowFrom"),
  ADD CONSTRAINT "Discount_windowCapacity_check" CHECK ("windowCapacity" BETWEEN 1 AND 500);

-- Order: rejim (eskilari — APPOINTMENT), usul endi ixtiyoriy, eslatmalar
ALTER TABLE "Order" ADD COLUMN "kind" "BookingMode" NOT NULL DEFAULT 'APPOINTMENT';
ALTER TABLE "Order" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "mode" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "reminders" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "Order_kind_status_slotEnd_idx" ON "Order"("kind", "status", "slotEnd");

-- Sig'im: biznes × slot → chegirma × slot (band qilingan joylar ochiq/yakunlangan buyurtmalardan qayta hisoblanadi)
CREATE TABLE "BookingSeat" (
    "discountId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "booked" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BookingSeat_pkey" PRIMARY KEY ("discountId","startsAt"),
    CONSTRAINT "BookingSeat_booked_check" CHECK ("booked" >= 0)
);
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BookingSeat" ("discountId", "startsAt", "booked")
SELECT "discountId", "slotStart", count(*)::int FROM "Order"
WHERE status NOT IN ('REJECTED', 'CANCELLED')
GROUP BY "discountId", "slotStart";

DROP TABLE "PreorderSlot";

-- PreorderSettings: usul, slot uzunligi va sig'im endi chegirmada
ALTER TABLE "PreorderSettings" DROP CONSTRAINT "PreorderSettings_slotMinutes_check";
ALTER TABLE "PreorderSettings" DROP CONSTRAINT "PreorderSettings_slotCapacity_check";
ALTER TABLE "PreorderSettings" DROP COLUMN "mode", DROP COLUMN "slotMinutes", DROP COLUMN "slotCapacity";
DROP TYPE "PreorderMode";
