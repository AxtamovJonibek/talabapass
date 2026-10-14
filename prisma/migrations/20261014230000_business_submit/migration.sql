-- Biznes arizasi qachon tekshiruvga yuborilgan (hujjatlar yuklangach). Mavjud arizalar — yaratilgan paytda.
DROP INDEX "Business_status_idx";

ALTER TABLE "Business" ADD COLUMN "submittedAt" TIMESTAMP(3);
UPDATE "Business" SET "submittedAt" = "createdAt";

CREATE INDEX "Business_status_submittedAt_idx" ON "Business"("status", "submittedAt");
