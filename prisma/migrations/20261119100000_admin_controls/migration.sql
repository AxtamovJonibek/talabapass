-- CreateEnum
CREATE TYPE "LandingStatsMode" AS ENUM ('AUTO', 'MANUAL', 'HIDDEN');

-- CreateEnum
CREATE TYPE "LandingDealsMode" AS ENUM ('AUTO', 'MANUAL', 'MIXED');

-- CreateTable
CREATE TABLE "BusinessPermissions" (
    "businessId" TEXT NOT NULL,
    "canCreateDiscounts" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "canPreorder" BOOLEAN NOT NULL DEFAULT true,
    "canAddCashiers" BOOLEAN NOT NULL DEFAULT true,
    "maxActiveDiscounts" INTEGER,
    "canEditProfile" BOOLEAN NOT NULL DEFAULT true,
    "canEditContacts" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPermissions_pkey" PRIMARY KEY ("businessId")
);

-- CreateTable
CREATE TABLE "LandingSettings" (
    "id" TEXT NOT NULL DEFAULT 'landing',
    "statsMode" "LandingStatsMode" NOT NULL DEFAULT 'AUTO',
    "statsStudents" INTEGER,
    "statsBusinesses" INTEGER,
    "statsDiscounts" INTEGER,
    "statsSaved" INTEGER,
    "dealsMode" "LandingDealsMode" NOT NULL DEFAULT 'AUTO',
    "dealIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPartner" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "name" TEXT NOT NULL,
    "logoKey" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingPartner_businessId_key" ON "LandingPartner"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessPermissions" ADD CONSTRAINT "BusinessPermissions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPartner" ADD CONSTRAINT "LandingPartner_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

