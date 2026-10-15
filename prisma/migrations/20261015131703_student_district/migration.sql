-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "districtId" TEXT;

-- CreateIndex
CREATE INDEX "StudentProfile_districtId_idx" ON "StudentProfile"("districtId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;
