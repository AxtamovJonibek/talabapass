CREATE TYPE "UniversityKind" AS ENUM ('STATE', 'PRIVATE', 'FOREIGN', 'OTHER');
CREATE TYPE "UniversityRequestStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

ALTER TABLE "University"
  ADD COLUMN "region" TEXT NOT NULL DEFAULT 'Toshkent shahri',
  ADD COLUMN "kind" "UniversityKind" NOT NULL DEFAULT 'STATE',
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "University_region_idx" ON "University"("region");

CREATE TABLE "UniversityRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "status" "UniversityRequestStatus" NOT NULL DEFAULT 'PENDING',
  "universityId" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UniversityRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UniversityRequest_status_createdAt_idx" ON "UniversityRequest"("status", "createdAt");
CREATE INDEX "UniversityRequest_userId_idx" ON "UniversityRequest"("userId");
ALTER TABLE "UniversityRequest" ADD CONSTRAINT "UniversityRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniversityRequest" ADD CONSTRAINT "UniversityRequest_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
