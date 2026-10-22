# Production'ga chiqishdan oldingi ro'yxat

Har band yo bajarilgan, yo egasi tomonidan ongli ravishda qoldirilgan bo'lishi kerak. Server `NODE_ENV=production` da
xavfli sozlamani topsa (`OTP_FIXED_CODE`, `SMS_PROVIDER=dev`, admin xeshi yo'q, VAPID to'liq emas) ishga tushmaydi
(`src/server/env-check.ts`) — bu oxirgi to'siq, ro'yxat o'rnini bosmaydi.

Belgi: **[BLOK]** — shu bo'lmasa chiqmaymiz · **[TAVSIYA]** — chiqishdan oldin qilish kerak, lekin to'sib qo'ymaydi.

## 1. Kirish va xavfsizlik
- [ ] **[BLOK] SMS provayder** (Eskiz.uz yoki boshqa) — `src/server/sms.ts` adapteri orqali ulanadi; Vercel'da `SMS_PROVIDER=<nom>`
      va provayder sirlari. `SMS_PROVIDER=dev` bo'lsa server ishga tushmaydi. Sender nomi provayderda tasdiqlangan bo'lishi kerak
      (O'zbekistonda alfa-nom moderatsiyadan o'tadi — oldindan so'rang). Ulagach: haqiqiy raqamda kod kelishini, 60 soniya/5 ta chegarani tekshiring.
- [ ] **[BLOK] `000000` ni o'chirish** — Vercel Production muhitida `OTP_FIXED_CODE` bo'lmasin (faqat `.env.development` va sinov serveri).
      `APP_ENV=staging` ni Production muhitiga **qo'ymang**: shu bayroq dev yo'llariga ruxsat beradi. Tekshiruv: production havolasida
      `+998…` raqamga `000000` bilan kirib bo'lmasligi kerak.
- [ ] **[BLOK] Admin TOTP** — hozir ikkinchi qadam: SMS + umumiy parol (`ADMIN_PASSWORD_HASH`). Production uchun har admin uchun alohida
      authenticator (TOTP) va zaxira kodlar kerak. Qurilmaguncha: parol uzun (≥ 20 belgi), faqat 1–2 admin, SMS provayder ishonchli.
      Qurilmagan bo'lsa — bu xavfni egasi yozma qabul qiladi.
- [ ] **[BLOK] Kalitlarni almashtirish** — sinov serveri va lokal kalitlar production'da ishlatilmaydi. Production uchun yangi:
  | Kalit | Qanday yaratiladi | Almashtirsangiz nima bo'ladi |
  |---|---|---|
  | `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | barcha sessiyalar, OTP xeshlari, kupon secretlari (AES kaliti shundan) yaroqsiz bo'ladi — **ishga tushgandan keyin almashtirmang**, almashtirilsa faol kuponlar o'chiriladi |
  | `ADMIN_PASSWORD_HASH` | `npm run admin:hash` | admin yangi parol bilan kiradi |
  | `CRON_SECRET` | tasodifiy ≥ 32 belgi | Vercel va GitHub Actions secrets'ni birga yangilang |
  | `VAPID_*` | `npm run push:keys` | barcha push obunalari ishlamay qoladi (qayta yoqish kerak) |
  | R2 `S3_ACCESS_KEY_ID/SECRET` | Cloudflare → R2 → API token (faqat shu bucket, Object Read & Write) | fayllar o'qilmay qoladi — avval yangisini qo'ying |
  | `DATABASE_URL(_UNPOOLED)` | Neon production branch | — |
- [ ] **[TAVSIYA]** Rate limit IP'si: hosting `x-forwarded-for` ni o'zi yozishini tekshiring (Vercel — ha; boshqa hostingda proksi sozlamasi).

## 2. Ma'lumot va fayllar
- [ ] **[BLOK] Fayllar Cloudflare R2'da** — `STORAGE_DRIVER=s3`; bucket **private** (public access o'chiq, custom domain ulanmagan);
      production uchun alohida bucket (sinov bucket'i bilan umumiy emas). Eski sinov fayllari ko'chirilmaydi.
- [ ] **[BLOK] Ma'lumotlarni O'zbekistonda saqlash** — W3 matnida "O'zbekiston hududidagi serverlar" deyilgan, hozirgi hosting esa
      Vercel (fra1) / Neon / R2 — O'zbekiston tashqarisida. "Shaxsiy ma'lumotlar to'g'risida"gi qonun talabini yurist baholaydi; ikki yo'l:
      (a) bazani va fayllarni mahalliy serverga ko'chirish, (b) matnni haqiqatga moslash va yurist ruxsatini olish.
      **Matn o'zboshimchalik bilan o'zgartirilmaydi.**
- [ ] **[BLOK] Guvohnoma rasmlarini o'chirish** — siyosatda "tekshiruvdan keyin [N] kun" va'da qilingan; hozir o'chiruvchi cron yo'q.
      Muddatni belgilab, cron + test yozish kerak (yo'q bo'lsa — siyosatdagi va'da yolg'on).
- [ ] **[TAVSIYA]** PDF ichidagi rasmlarning EXIF'i tozalanmaydi (`sanitizeDocument`). Yo PDF'ni rasmga aylantiring, yo cheklovni yozma qabul qiling.
- [ ] **[TAVSIYA]** Vercel so'rov tanasi ≤ 4.5 MB: undan katta guvohnoma/hujjat yuklanmaydi → presigned (to'g'ridan-to'g'ri R2) yuklash.
- [ ] **[TAVSIYA]** Neon: production branch uchun point-in-time restore yoqilgan, backup muddati tekshirilgan.

## 3. Huquqiy matnlar (`messages/uz.json`)
To'ldirilmagan joylar (egasidan kutilmoqda, o'ylab topilmaydi): `[EMAIL]`, `[TELEFON RAQAM]`, `[MANZIL]`,
`[YURIDIK SHAXS NOMI]`, `[STIR]`, `[TARIF MA'LUMOTI]`, `[N] kun`, `[N] ish kuni`.
- [ ] **[BLOK]** Hammasi to'ldirilgan: `grep -n "\[[A-ZА-Я' ]*\]" messages/uz.json` hech narsa chiqarmasin.
- [ ] **[BLOK]** Maxfiylik siyosati, foydalanish shartlari, biznes shartlari yurist ko'rigidan o'tgan; shartlar versiyasi
      (`business.submit` audit yozuvidagi) yangilangan.
- [ ] **[TAVSIYA]** Landing statistikasi (`STATS_MIN`) — real raqamlar bilan; sinov ma'lumotlari (seed) production bazasida yo'q.

## 4. Cron va bildirishnomalar
- [ ] **[BLOK]** Vercel'da `CRON_SECRET` — `vercel.json` cron'lari (kuponlar, bildirishnomalar) kuniga 1 marta (Hobby). Kuponlar lazy ham tozalanadi.
- [ ] **[BLOK]** GitHub Actions secrets: `CRON_SECRET`, `APP_URL` (production havolasi) — aks holda rejalashtirilgan xabarlar kuniga bir marta ketadi.
- [ ] **[TAVSIYA]** `pruneOtpData` (eski OTP va rate-limit yozuvlari) — hozir cron'ga ulanmagan; jadval o'sadi. Cron yo'liga qo'shing.
- [ ] **[TAVSIYA]** Web Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`) uchalasi birga. Bo'lmasa faqat ilova ichidagi xabarlar.

## 5. Muhit va deploy
- [ ] **[BLOK]** Alohida Vercel Production muhiti, alohida Neon branch, `DATABASE_URL` (pooled) va `DATABASE_URL_UNPOOLED` (migratsiya uchun).
- [ ] **[BLOK]** Birinchi deploy'dan keyin: `prisma migrate deploy` o'tgan (vercel-build ichida), admin hisobi ochilgan, **seed ishga tushirilmagan**.
- [ ] **[BLOK]** `DATABASE_POOL_MAX` Production'da qo'yilmagan (faqat lokal PGlite uchun).
- [ ] **[BLOK]** Domen va HTTPS; `NEXT_PUBLIC_*`/`APP_URL` yangi domenga; Vercel `*.vercel.app` ga noindex qolsin yoki domen yo'naltirilsin.
- [ ] **[TAVSIYA]** Monitoring: Vercel Logs + xatolar uchun Sentry (yo'q); uptime tekshiruvi `/`.

## 6. Chiqishdan oldingi qo'l bilan tekshiruv (production havolasida)
1. Talaba: ro'yxat → guvohnoma → (admin tasdiqlaydi) → chegirma olish → kassir skanerlaydi → chek PDF.
2. Biznes: ariza → admin tasdiqlaydi → chegirma → tasdiq → kassir taklifi.
3. Admin: parol bosqichi, blokdan chiqarish, bildirishnoma yuborish (push + SMS).
4. Telefonda PWA o'rnatiladi; kupon ochilgach tarmoq o'chirilsa ham ochiladi.
5. `npm run test:e2e -- navigation` — `E2E_BASE_URL=<production>` bilan (faqat o'qish).
