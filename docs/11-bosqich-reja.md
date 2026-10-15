# 11-bosqich reja — yakunlash: profil, PWA, holatlar, navigatsiya testi, ishga tushirish ro'yxati

## 1. Yiqilgan e2e
- Sabab: lokal `prisma dev` (PGlite) jarayoni qotib, ulanishni yopadi (`Server has closed the connection`, `P1017`, `ECONNRESET`) —
  kod xatosi emas. Birinchi yiqilishdan keyin keyingi testlar ham "did not run" bo'ladi.
- Chora: avval `npm run db:dev` ni qayta ko'tarish (ma'lumot saqlanadi). Qoldiq xatolar bo'lsa — alohida tahlil.
- Neon dev branch: Neon API kaliti/`neonctl` kirishi yo'q; sinov serverining bazasi (staging) e2e uchun ishlatilmaydi
  (testlar ma'lumotni o'zgartiradi). Kerak bo'lsa foydalanuvchi Neon'da `dev-e2e` branch ochib, `DATABASE_URL` ni beradi.
- Maqsad: `npm run test:e2e` to'liq yashil.

## 2. Profil (T8 / WT4)
- Sxema: `StudentProfile.districtId` (ixtiyoriy, `District` ga). Migratsiya.
- `/profil`: telefon — T8 (ID karta, jami tejalgan, xaridlar, menyu, bildirishnoma kaliti, til, chiqish);
  veb — WT4 yon paneli (karta, statistikalar, menyu) + "Sozlamalar" kartasi. `/tarix` veb yon panelidagi menyu `/profil` ga olib boradi.
- "Shaxsiy ma'lumotlar" (`/profil/tahrir`): ism, familiya, fakultet, kurs, tuman. Universitet va guvohnoma ma'lumoti o'zgarmaydi
  (tasdiqlangan ma'lumot — o'zgarishi qayta tekshiruv talab qiladi, shu bosqichda yo'q). Server action `updateProfileAction`: `requireActiveStudent`, zod.
- Bildirishnoma kaliti: `StudentProfile.notifyDeals` (server action).
- Til: hozir faqat o'zbekcha — qator ko'rsatiladi, tanlov yo'q (ru/en tarjimalari yo'q; yolg'on tanlov qo'shilmaydi).
- Guvohnoma sahifasi (`/profil/guvohnoma`): holat, raqam, amal muddati; muddati o'tayotgan bo'lsa yangilash.
- "Hudud" auditoriyasi: `audience.ts` `DISTRICT` — `StudentProfile.districtId` bo'yicha (oldingi "kupon olganlar" taxmini o'chadi).
- Testlar: `profile.test.ts` (zod), `profile.itest.ts` (action, audience), `e2e/profile.spec.ts`.

## 3. "Keyingi bosqichlarda quriladi" sahifalari
`PlaceholderHome` ishlatilgan joylar qidiriladi va haqiqiy sahifa bilan almashtiriladi; havolasiz qolgan menyu bandlari
(`Yordam markazi`, `Shaxsiy ma'lumotlar`, `Talaba guvohnomasi`, biznes profilini tahrirlash) — yo ishlaydigan sahifa, yo olib tashlanadi.
Natijada bo'sh yoki "tez orada" sahifa qolmaydi.

## 4. PWA
- `public/manifest.webmanifest`, ikonkalar (192/512/maskable, `apple-touch-icon`) — mavjud logotipdan (yangi rang/shakl qo'shilmaydi).
- `public/sw.js` (push mantiqi saqlanadi) + Serwist o'rniga qo'lda yozilgan kichik service worker: Next 16 / Turbopack da
  `@serwist/next` ishlamaydi. `/_next/static` — cache-first; navigatsiya — network-first, tarmoq yo'q bo'lsa `/oflayn`;
  ochilgan kupon sahifasi (`/kuponlar/<id>`) muvaffaqiyatli yuklangach keshlanadi va tarmoqsiz ochiladi (QR TOTP kliyentda hisoblanadi).
  Chiqishda (logout) kesh tozalanadi — kupon boshqa foydalanuvchiga qolmaydi.
- `/oflayn` sahifasi (statik).
- Ro'yxatdan o'tkazish: `ServiceWorkerRegister` (faqat production yoki `NEXT_PUBLIC_SW=1`).

## 5. Bo'sh / xato / yuklanish holatlari
- Har bir rol guruhiga `error.tsx` (qayta urinish tugmasi), `not-found.tsx`, `loading.tsx` (skelet — mavjud ranglardan).
- Ro'yxat ekranlarida bo'sh holat matni tekshiriladi (kuponlar, tarix, chegirmalar, sotuvlar, kassirlar, admin navbatlari, bildirishnomalar).

## 6. Navigatsiya testi
- `e2e/navigation.spec.ts`: mehmon, talaba, biznes egasi, kassir, admin × 390 va 1440. Har sahifada ko'rinadigan barcha ichki `<a href>`
  yig'iladi, har biri ochiladi: status < 400, "bo'sh/tez orada" matni yo'q, rolga mos sahifa. `E2E_BASE_URL` berilsa jonli havolada ham yuradi
  (jonli havolada yozadigan amallarsiz — faqat o'qish).
- A1/A3 `design:compare` jonli havolada.

## 7. `docs/ishga-tushirish.md`
Production'dan oldingi ro'yxat: SMS provayder, admin TOTP, `OTP_FIXED_CODE`/`SMS_PROVIDER=dev` o'chirish, ma'lumotlarni O'zbekistonda saqlash,
huquqiy `[..]` joylar, kalitlarni almashtirish (AUTH_SECRET, VAPID, CRON_SECRET, ADMIN_PASSWORD_HASH, R2), cron'lar, zaxira.

## Tartib
1 → 2 → 3 → 5 → 4 → 6 → 7. Har yirik qismdan keyin `typecheck`, `lint`, `test`; oxirida to'liq e2e, commit, push.
