/**
 * Web Push uchun VAPID kalit juftligini yaratadi: `npm run push:keys`.
 * Chiqqan qiymatlarni Vercel Environment Variables ga qo'ying (yopiq kalitni hech kimga bermang va repoga yozmang).
 * Kalit juftligini almashtirsangiz, mavjud push obunalari ishlamay qoladi — foydalanuvchilar qayta yoqishi kerak.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log(`
VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
VAPID_SUBJECT=mailto:<sizning-emailingiz>
`);
