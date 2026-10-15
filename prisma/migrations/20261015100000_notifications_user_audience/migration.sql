-- Bitta foydalanuvchiga tizim xabari (tasdiq/rad): admin "Yuborilganlar" tarixida ko'rinmaydi.
ALTER TYPE "Audience" ADD VALUE 'USER';

-- Rejalashtirilgan xabarlarni tez topish va admin qidiruvi uchun
CREATE INDEX "UserNotification_notificationId_readAt_idx" ON "UserNotification"("notificationId", "readAt");
