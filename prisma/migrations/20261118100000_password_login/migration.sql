-- Parol bilan kirish: parol vaqtlari, majburiy almashtirish, oxirgi kirish; email tiklash kodlari.
ALTER TABLE "User" ADD COLUMN "passwordSetAt" TIMESTAMP(3),
ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Mavjud parollar: aniq vaqti noma'lum — oxirgi yangilanish vaqti olinadi
UPDATE "User" SET "passwordSetAt" = "updatedAt", "passwordChangedAt" = "updatedAt" WHERE "passwordHash" IS NOT NULL;

CREATE TABLE "EmailCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailCode_email_createdAt_idx" ON "EmailCode"("email", "createdAt");
