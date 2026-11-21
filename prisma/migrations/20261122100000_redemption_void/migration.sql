-- Admin xato sotuvni bekor qiladi: faqat yangi nullable ustunlar (mavjud ma'lumot va eski kod buzilmaydi)
ALTER TABLE "Redemption" ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidReason" TEXT,
ADD COLUMN "voidedById" TEXT;
