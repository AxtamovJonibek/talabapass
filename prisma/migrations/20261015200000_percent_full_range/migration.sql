-- Foiz 1–100 (100 — bepul)
ALTER TABLE "Discount" DROP CONSTRAINT "Discount_percent_check";
ALTER TABLE "Discount"
  ADD CONSTRAINT "Discount_percent_check" CHECK ("percent" IS NULL OR "percent" BETWEEN 1 AND 100);
