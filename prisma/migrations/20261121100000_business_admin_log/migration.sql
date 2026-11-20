-- CreateTable
CREATE TABLE "BusinessChange" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessContactNote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adminId" TEXT,
    "contacted" BOOLEAN NOT NULL DEFAULT true,
    "contactedAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessChange_businessId_createdAt_idx" ON "BusinessChange"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessContactNote_businessId_createdAt_idx" ON "BusinessContactNote"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessChange" ADD CONSTRAINT "BusinessChange_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContactNote" ADD CONSTRAINT "BusinessContactNote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
