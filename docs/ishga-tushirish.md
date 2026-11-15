# Production'ga chiqishdan oldingi ro'yxat

Har band yo bajarilgan, yo egasi tomonidan ongli ravishda qoldirilgan bo'lishi kerak. Server `NODE_ENV=production` da
xavfli sozlamani topsa (`OTP_FIXED_CODE`, `SMS_PROVIDER=dev`, admin xeshi yo'q, VAPID to'liq emas) ishga tushmaydi
(`src/server/env-check.ts`) — bu oxirgi to'siq, ro'yxat o'rnini bosmaydi.

Belgi: **[BLOK]** — shu bo'lmasa chiqmaymiz · **[TAVSIYA]** — chiqishdan oldin qilish kerak, lekin to'sib qo'ymaydi.

## 1. Kirish va xavfsizlik
- [ ] **[BLOK] SMS provayder** (Eskiz.uz yoki boshqa) — `src/server/sms.ts` adapteri orqali ulanadi; serverda (`/etc/talabapass/env`) `SMS_PROVIDER=<nom>`
      va provayder sirlari. `SMS_PROVIDER=dev` bo'lsa server ishga tushmaydi. Sender nomi provayderda tasdiqlangan bo'lishi kerak
      (O'zbekistonda alfa-nom moderatsiyadan o'tadi — oldindan so'rang). Ulagach: haqiqiy raqamda kod kelishini, 60 soniya/5 ta chegarani tekshiring.
- [ ] **[BLOK] `000000` ni o'chirish** — production muhitida (`/etc/talabapass/env`) `OTP_FIXED_CODE` bo'lmasin (faqat `.env.development` va sinov serveri).
      `APP_ENV=staging` ni production muhitiga **qo'ymang**: shu bayroq dev yo'llariga ruxsat beradi. Tekshiruv: production havolasida
      `+998…` raqamga `000000` bilan kirib bo'lmasligi kerak.
- [ ] **[BLOK] Admin TOTP** — hozir ikkinchi qadam: SMS + umumiy parol (`ADMIN_PASSWORD_HASH`). Production uchun har admin uchun alohida
      authenticator (TOTP) va zaxira kodlar kerak. Qurilmaguncha: parol uzun (≥ 20 belgi), faqat 1–2 admin, SMS provayder ishonchli.
      Qurilmagan bo'lsa — bu xavfni egasi yozma qabul qiladi.
- [ ] **[BLOK] Kalitlarni almashtirish** — sinov serveri va lokal kalitlar production'da ishlatilmaydi. Production uchun yangi:
  | Kalit | Qanday yaratiladi | Almashtirsangiz nima bo'ladi |
  |---|---|---|
  | `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | barcha sessiyalar, OTP xeshlari, kupon secretlari (AES kaliti shundan) yaroqsiz bo'ladi — **ishga tushgandan keyin almashtirmang**, almashtirilsa faol kuponlar o'chiriladi |
  | `ADMIN_PASSWORD_HASH` | `npm run admin:hash` | admin yangi parol bilan kiradi |
  | `CRON_SECRET` | tasodifiy ≥ 32 belgi | `/etc/talabapass/env` va crontab'ni birga yangilang |
  | `VAPID_*` | `npm run push:keys` | barcha push obunalari ishlamay qoladi (qayta yoqish kerak) |
  | `S3_ACCESS_KEY_ID/SECRET` (faqat `STORAGE_DRIVER=s3` bo'lsa) | S3 xizmatida API kalit (faqat shu bucket, o'qish/yozish) | fayllar o'qilmay qoladi — avval yangisini qo'ying |
  | `DATABASE_URL` | serverdagi PostgreSQL (production uchun alohida baza va foydalanuvchi) | — |
- [ ] **[TAVSIYA]** Rate limit IP'si: hosting `x-forwarded-for` ni o'zi yozishini tekshiring (nginx: `proxy_set_header X-Forwarded-For $remote_addr;`, docs/server.md).

## 2. Ma'lumot va fayllar
- [ ] **[BLOK] Fayllar serverda** — `STORAGE_DRIVER=local`, `STORAGE_LOCAL_DIR` kod papkasidan tashqarida (nginx orqali berilmaydi,
      faqat ilova foydalanuvchisi o'qiydi) va alohida zaxiralanadi (`pg_dump` nusxasiga kirmaydi). Sinov fayllari production'ga ko'chirilmaydi.
- [ ] **[BLOK] Ma'lumotlarni O'zbekistonda saqlash** — W3 matnida "O'zbekiston hududidagi serverlar" deyilgan, hozirgi hosting —
      Airnet VPS (baza va fayllar shu serverda). "Shaxsiy ma'lumotlar to'g'risida"gi qonun talabiga mosligini yurist tasdiqlaydi.
      **Matn o'zboshimchalik bilan o'zgartirilmaydi.**
- [ ] **[BLOK] Guvohnoma rasmlarini o'chirish** — siyosatda "tekshiruvdan keyin [N] kun" va'da qilingan; hozir o'chiruvchi cron yo'q.
      Muddatni belgilab, cron + test yozish kerak (yo'q bo'lsa — siyosatdagi va'da yolg'on).
- [ ] **[TAVSIYA]** PDF ichidagi rasmlarning EXIF'i tozalanmaydi (`sanitizeDocument`). Yo PDF'ni rasmga aylantiring, yo cheklovni yozma qabul qiling.
- [ ] **[TAVSIYA]** Baza zaxirasi: deploy oldidagi `pg_dump` dan tashqari muntazam (kunlik) nusxa va uni tiklash sinovdan o'tgan.

## 3. Huquqiy matnlar (`messages/uz.json`)
To'ldirilmagan joylar (egasidan kutilmoqda, o'ylab topilmaydi): `[EMAIL]`, `[TELEFON RAQAM]`, `[MANZIL]`,
`[YURIDIK SHAXS NOMI]`, `[STIR]`, `[TARIF MA'LUMOTI]`, `[N] kun`, `[N] ish kuni`.
- [ ] **[BLOK]** Hammasi to'ldirilgan: `grep -n "\[[A-ZА-Я' ]*\]" messages/uz.json` hech narsa chiqarmasin.
- [ ] **[BLOK]** Maxfiylik siyosati, foydalanish shartlari, biznes shartlari yurist ko'rigidan o'tgan; shartlar versiyasi
      (`business.submit` audit yozuvidagi) yangilangan.
- [ ] **[TAVSIYA]** Landing statistikasi (`STATS_MIN`) — real raqamlar bilan; sinov ma'lumotlari (seed) production bazasida yo'q.

## 4. Cron va bildirishnomalar
- [ ] **[BLOK]** Serverda `CRON_SECRET` va crontab (`/api/cron/bildirishnomalar`, `buyurtmalar`, `kuponlar` — docs/server.md) — aks holda
      rejalashtirilgan xabarlar faqat admin sahifasi ochilganda ketadi. Kuponlar lazy ham tozalanadi.
- [ ] **[TAVSIYA]** `pruneOtpData` (eski OTP va rate-limit yozuvlari) — hozir cron'ga ulanmagan; jadval o'sadi. Cron yo'liga qo'shing.
- [ ] **[BLOK]** Buyurtmalar avtomatikasi (`/api/cron/buyurtmalar`, crontab) ishlayapti — aks holda javobsiz buyurtmalar
      10 daqiqada bekor bo'lmaydi va pul qaytmaydi (sahifalar ochilganda lazy ham ishlaydi, lekin kafolat emas).
- [ ] **[TAVSIYA]** Telegram xabarnomalari: `TELEGRAM_BOT_TOKEN` va Telegram kirishi (`User.telegramChatId` to'ldiriladi) — hozir ulanmagan.
- [ ] **[TAVSIYA]** Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`) uchalasi birga. Bo'lmasa faqat ilova ichidagi xabarlar.

## 4a. To'lov (oldindan band qilish)
- [ ] **[BLOK] Haqiqiy to'lov provayderi** — hozir faqat SOXTA `MockProvider` (`src/lib/payments/mock.ts`), u faqat ishlab chiqish va sinov
      serverida yoqiladi. Production'da provayder ulanmaguncha oldindan to'lovli band qilish yopiq ("Onlayn to'lov hozircha ulanmagan"),
      to'lovsiz bron ishlaydi. Provayder `PaymentProvider` interfeysiga (`src/lib/payments/types.ts`) ulanadi: hold → capture/cancelHold, refund,
      `verifyCallback` (callback: `POST /api/tolov/<provayder>`). Ulangach: callback imzosi, summa mosligi va idempotentlik qayta tekshirilsin.
- [ ] **[BLOK]** Provayderning `holdMaxDays` qiymati — kartada pulni necha kun ushlab tura oladi (provayder hujjatidan). Shundan uzoq yashaydigan
      "To'lab olib ketish" buyurtmalari to'lovdan keyin darhol yechiladi va qaytarish refund bilan bo'ladi; qiymat noto'g'ri bo'lsa hold muddatidan
      oldin o'z-o'zidan bekor bo'lib, biznes pulni ololmasligi mumkin. Refund komissiyasi va muddati oferta matnida.
- [ ] **[BLOK]** Bekor qilish/kelmaslik qoidasi va to'lov shartlari biznes shartnomasi va oferta matnida yozilgan (yurist).

## 5. Muhit va deploy
- [ ] **[BLOK]** Production uchun alohida baza (`DATABASE_URL`) va `/etc/talabapass/env` (namuna — `.env.server.example`); `APP_ENV` yo'q.
- [ ] **[BLOK]** Birinchi deploy'dan keyin: `prisma migrate deploy` o'tgan (`deploy/deploy.sh` ichida), admin hisobi ochilgan, **seed ishga tushirilmagan**.
- [ ] **[BLOK]** `DATABASE_POOL_MAX` Production'da qo'yilmagan (faqat lokal PGlite uchun).
- [ ] **[BLOK]** Domen va HTTPS; `NEXT_PUBLIC_*` yangi domenga; nginx TLS sertifikati yangilanishi (certbot) ishlayapti.
- [ ] **[TAVSIYA]** Monitoring: `pm2 logs` + xatolar uchun Sentry (yo'q); uptime tekshiruvi `/`.

## 6. Chiqishdan oldingi qo'l bilan tekshiruv (production havolasida)
1. Talaba: ro'yxat → guvohnoma → (admin tasdiqlaydi) → chegirma olish → kassir skanerlaydi → chek PDF.
2. Biznes: ariza → admin tasdiqlaydi → chegirma → tasdiq → kassir taklifi.
3. Admin: parol bosqichi, blokdan chiqarish, bildirishnoma yuborish (push + SMS).
4. Telefonda PWA o'rnatiladi; kupon ochilgach tarmoq o'chirilsa ham ochiladi.
5. `npm run test:e2e -- navigation` — `E2E_BASE_URL=<production>` bilan (faqat o'qish).
