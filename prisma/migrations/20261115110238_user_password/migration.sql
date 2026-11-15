-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordFails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordLockedUntil" TIMESTAMP(3);
