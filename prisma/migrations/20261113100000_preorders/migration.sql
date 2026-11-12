-- CreateEnum
CREATE TYPE "PreorderMode" AS ENUM ('PICKUP', 'DINE_IN', 'BOTH');

-- CreateEnum
CREATE TYPE "OrderMode" AS ENUM ('PICKUP', 'DINE_IN');

-- CreateEnum
CREATE TYPE "PrepayType" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'HELD', 'CAPTURED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED');

-- AlterTable
ALTER TABLE "Discount" ADD COLUMN     "preorder" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "PreorderSettings" (
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" "PreorderMode" NOT NULL DEFAULT 'BOTH',
    "schedule" JSONB NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "slotCapacity" INTEGER NOT NULL DEFAULT 10,
    "leadMinutes" INTEGER NOT NULL DEFAULT 30,
    "daysAhead" INTEGER NOT NULL DEFAULT 1,
    "prepay" "PrepayType" NOT NULL DEFAULT 'FULL',
    "prepayPercent" INTEGER NOT NULL DEFAULT 50,
    "freeCancelMinutes" INTEGER NOT NULL DEFAULT 60,
    "keepPercent" INTEGER NOT NULL DEFAULT 100,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT true,
    "pausedOn" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreorderSettings_pkey" PRIMARY KEY ("businessId")
);

-- CreateTable
CREATE TABLE "PreorderSlot" (
    "businessId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "booked" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PreorderSlot_pkey" PRIMARY KEY ("businessId","startsAt")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mode" "OrderMode" NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "slotEnd" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" VARCHAR(200),
    "phone" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "secret" BYTEA NOT NULL,
    "rejectReason" TEXT,
    "title" TEXT NOT NULL,
    "unitOriginal" INTEGER NOT NULL,
    "unitFinal" INTEGER NOT NULL,
    "totalOriginal" INTEGER NOT NULL,
    "totalFinal" INTEGER NOT NULL,
    "prepay" "PrepayType" NOT NULL,
    "prepayAmount" INTEGER NOT NULL,
    "freeCancelMinutes" INTEGER NOT NULL,
    "keepPercent" INTEGER NOT NULL,
    "autoConfirm" BOOLEAN NOT NULL,
    "confirmBy" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "from" "OrderStatus",
    "to" "OrderStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "captured" INTEGER NOT NULL DEFAULT 0,
    "refunded" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLog" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_businessId_status_slotStart_idx" ON "Order"("businessId", "status", "slotStart");

-- CreateIndex
CREATE INDEX "Order_studentId_createdAt_idx" ON "Order"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_confirmBy_idx" ON "Order"("status", "confirmBy");

-- CreateIndex
CREATE INDEX "Order_status_slotEnd_idx" ON "Order"("status", "slotEnd");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentLog_paymentId_createdAt_idx" ON "PaymentLog"("paymentId", "createdAt");

-- AddForeignKey
ALTER TABLE "PreorderSettings" ADD CONSTRAINT "PreorderSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreorderSlot" ADD CONSTRAINT "PreorderSlot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bazadagi chegaralar (forma/server tekshiruvining ikkinchi qulfi)
ALTER TABLE "PreorderSettings"
  ADD CONSTRAINT "PreorderSettings_slotMinutes_check" CHECK ("slotMinutes" IN (15, 30, 60)),
  ADD CONSTRAINT "PreorderSettings_slotCapacity_check" CHECK ("slotCapacity" BETWEEN 1 AND 500),
  ADD CONSTRAINT "PreorderSettings_prepayPercent_check" CHECK ("prepayPercent" BETWEEN 1 AND 100),
  ADD CONSTRAINT "PreorderSettings_keepPercent_check" CHECK ("keepPercent" BETWEEN 0 AND 100);
ALTER TABLE "PreorderSlot" ADD CONSTRAINT "PreorderSlot_booked_check" CHECK ("booked" >= 0);
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_quantity_check" CHECK ("quantity" BETWEEN 1 AND 50),
  ADD CONSTRAINT "Order_prepayAmount_check" CHECK ("prepayAmount" >= 0 AND "prepayAmount" <= "totalFinal");
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amounts_check" CHECK ("amount" >= 0 AND "captured" >= 0 AND "refunded" >= 0 AND "captured" <= "amount" AND "refunded" <= "captured");
