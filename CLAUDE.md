# talabaPass

O'zbekiston talabalari uchun chegirma platformasi. Talaba guvohnomasini tasdiqlatadi,
hamkor joyda QR ko'rsatib chegirma oladi. 4 qism: landing, talaba ilovasi, biznes paneli, admin.

Rollar: `STUDENT`, `BUSINESS_OWNER`, `CASHIER`, `ADMIN`. Har bir rol faqat o'z sahifalarini ko'radi.

## Ish tartibi
Ish bosqichlarga bo'lingan (reja: 11 bosqich). Har bir bosqich oxirida: `typecheck`, `lint`, `test`
o'tadi → `git commit` → **`git push`** (har commit'dan keyin) → foydalanuvchiga tekshirish ro'yxati beriladi.
Keyingi bosqich tasdiqdan so'ng.

**Foydalanuvchi sinovi faqat Vercel havolasida** (https://talabapass.vercel.app), localhost emas. Hisobot oxirida:
"Havolada tekshiring: [sahifalar]". Lokal ishga tushirish (`next build && next start`, e2e) — faqat o'zimizning
tekshiruvimiz uchun.

## Stack
Next.js App Router · TypeScript strict · Tailwind v4 · PostgreSQL (Neon) + Prisma 7 ·
next-intl · Cloudflare R2 · Serwist (PWA) · Vitest + Playwright. Deploy: Vercel. Paket menejeri: npm.

## Buyruqlar
```
npm run dev          ishlab chiqish serveri
npm run build        production build
npm run lint         ESLint
npm run typecheck    tsc --noEmit
npm test             Vitest (sof mantiq)
npm run test:db      baza bilan testlar (*.itest.ts) — lokal baza kerak
npm run test:e2e     Playwright (kamera testlari to'liq Chromium bilan: `npx playwright install chromium`)
npm run db:dev       lokal Postgres (prisma dev, Docker kerak emas) — alohida terminalda ishlab turadi;
                     kompyuter qayta yoqilgach o'zi ko'tarilmaydi (baza xatosi chiqsa birinchi shuni tekshiring)
npm run db:migrate   migratsiyalarni qo'llash
npm run db:seed      seed ma'lumotlar (namunaviy guvohnoma/hujjat fayllari bilan)
npm run files:sanitize  ombordagi fayllarni qayta tozalash, yo'qlarini namuna bilan to'ldirish
npm run dev:tunnel   telefonda kamerani sinash: dev serverni HTTPS tunnel bilan ochadi (ishlab turgan `npm run dev` kerak).
                     Tunnel ochiq ekan OTP_FIXED_CODE internetdan ishlaydi — sinovdan keyin darhol yoping.
```

## Papkalar
```
design/talabaPass.html   asl eksport — brauzerda ochib ekranlarni ko'rish uchun
design/screens/          28 ta ekranning o'qiladigan HTML'i (T1..WB2) — qiymatlar manbai, o'zgartirilmaydi
prisma/                  schema.prisma, migrations, seed.ts
messages/uz.json         barcha matnlar (ru.json, en.json keyin)
src/app/[locale]/(marketing)/   landing, kirish, huquqiy
src/app/[locale]/(student)/     talaba ilovasi
src/app/[locale]/(business)/    biznes paneli + kassir skaneri
src/app/[locale]/(admin)/       admin panel
src/app/api/             cron, fayl oqimi, push
src/components/ui/       dizayndan olingan primitivlar (Button, Field, Chip, Badge, Ticket...)
src/components/<feature>/
src/server/              auth, qr, storage, sms, push, queries, actions (faqat server)
src/lib/                 format (so'm, sana), geo, zod sxemalar, totp (klient + server umumiy)
```

Ekran ID'lari: T1–T8 talaba (mobil), B1–B6 biznes, A1–A3 admin, W1–W3 landing/kirish/huquqiy,
WT1–WT4 talaba (desktop), WB1–WB2 biznes (desktop). W1m/W2m — W1/W2 ning 390px ko'rinishi.

## Dizayn qoidalari
Dizaynga piksel darajasida sodiqlik. Ekran yozishdan oldin `design/screens/<ID>.html` ni och va
qiymatlarni o'sha yerdan ol. Dizaynda yo'q rang, shrift, soya, radius yoki komponent QO'SHILMAYDI.
Dizaynda yo'q ekran kerak bo'lsa — mavjud primitivlardan yig' va foydalanuvchiga ayt.

Ranglar (faqat shu tokenlar, `src/app/globals.css` dagi `@theme`):
```
ink #141414 · paper #F3F2EE · white #FFFFFF · admin-bg #EEEDE8 · surface #EEECE6
muted #5F5D57 · placeholder #8A877F · line #D6D3CA · line-soft #E2E0D8
blue #2433D6 (talaba/admin asosiy) · blue-2 #3646E4
orange #FF5B1F (biznes asosiy, "issiq" urg'u) · rust #B23A0C (biznes havola)
green #0F5F37 · green-live #1E9E5A · green-bg #E3F4EA
danger #B4230C · danger-bg #FBE3DC · warn #9A3A0E · warn-bg #FFF0E6 · info-bg #E6E8FB
qora yuzalar: #232321 #2A2A27 #2F2F2C #3A3A36 · ulardagi matn: #D8D5CD #BDBAB2 #A9A69E
kategoriya juftlari (fon/siyoh): taom #F4DCCB/#8A3410 · kofe #E8DDCC/#5B3A12 ·
  kitob #F1D9D9/#7E1F1F · xizmat #DDE1F7/#1E2A9E · sport #D7EEDF/#145A33 ·
  go'zallik #E2E2DE/#2E2E2B · kino #E9DDF0/#5B2479 · 1+1 #F3E6C4/#7A5508
issiqlik shkalasi: #EFEDE7 #FBD5C2 #FCA57D #FF6A2E #B83A0A
```

Rol mavzusi: talaba — ko'k CTA, oq matn. Biznes — to'q sariq CTA, qora matn. Kassir skaneri —
qora fon. Admin — #EEEDE8 fon, qora sidebar, ko'k urg'u.

Shriftlar: Archivo (variable, `wdth` o'qi majburiy) va IBM Plex Mono — `next/font` orqali self-host.
- Og'irlik: 600 / 700 / 800 / 900 (400 kam).
- `font-stretch`: logo 125%, sarlavha 110–112%, siqiq raqam/badge 62–75%.
- Sarlavha: letter-spacing −0.02…−0.045em, line-height 0.9–1.
- Mono: kodlar, vaqt, yorliqlar (katta harf, letter-spacing 0.06–0.12em).
- O'lcham: matn 12–15px, UI 16–18px, sarlavha 20–44px, landing `clamp(…cqw…)`.

O'lchamlar: chegara 1.5px (#D6D3CA oddiy, #141414 faol) · radius 10/12/14/16/18/22 ·
boshqaruv balandligi 44/48/52/56 · gap 6/10/12/14 · mobil yon padding 24 · pastki nav 84px.
Soya deyarli yo'q (faqat dizaynda aniq ko'rsatilgan holatlar). Gradient — faqat "chipta" tishli cheti.

Responsive: media query EMAS. Dizayndagi kabi container query (`cqw`), `clamp()`, `flex-wrap`,
`repeat(auto-fit, minmax(min(Npx,100%),1fr))`. Tekshiruv: 390px va 1440px.

## Ekran qanday quriladi — ikki yo'l
- **Statik marketing sahifalari** (landing, huquqiy): pastdagi "ko'chirish" tartibi bilan — inline `style`, `dz` doirasi.
  Faqat shu sahifalar uchun.
- **Ilova ekranlari** (kirish, talaba, biznes, admin): `src/components/ui` primitivlaridan Tailwind bilan yig'iladi.
  Dizaynga sodiqlik primitivlar orqali ta'minlanadi: qiymat dizayndan primitivga bir marta ko'chiriladi, ekranlar
  uni qayta ishlatadi. Takrorlanadigan blok nusxalanmaydi — ikkinchi marta kerak bo'lsa primitivga aylantiriladi.
  `design:gen` bu yerda faqat qiymatlarni o'qish uchun qoralama; uning chiqishi ilova kodiga ko'chirilmaydi.
  Tekshiruv bir xil: `design:compare` 390 va 1440 da.

Primitivga qiymat ko'chirishda: dizayn `content-box` da chizilgan. `box-sizing: border-box` yozilmagan elementda
balandlik/kenglik chegara va padding'ni o'z ichiga OLMAYDI — primitivda `box-content` ishlating (masalan `PhoneInput`),
aks holda 1–3px farq chiqadi. `<button>` va `box-sizing: border-box` yozilganlar — oddiy (border-box).
`<input>` ichida brauzerning standart 1px 2px padding'i bor (preflight uni olib tashlaydi).

Primitiv uslubini `className` bilan ustidan yozmang (`text-13`, `px-…`, rang): bir xil xususiyatning ikki klassi
qaysi biri yutishi kafolatlanmagan. Buning o'rniga primitivga variant/prop qo'shing (`Button size="wide-quiet"`,
`ToggleSquare textSize`). `className` faqat joylashuv uchun (margin, flex, absolute).

Telefon va veb uchun alohida chizilgan ekranlar (T1–T3 ↔ WT1): holat bitta hook'da, ko'rinish ikkita,
`PhoneOrWeb` 700px da almashtiradi. Ikkalasi DOM'da turadi — `id` lar farqli bo'lsin, testlarda `visible=true`.

Landing'dagi ma'lumotlar (7-bosqichda ulanadi, kodda `TODO(7-bosqich)` bilan belgilangan):
- Statistika raqamlari bazadan hisoblanadi; belgilangan chegaradan kichik bo'lsa bo'lim yashiriladi.
- Hamkorlar faqat bazadagi tasdiqlangan (`APPROVED`) bizneslardan chiqadi.
- "Hozir Toshkentda ochiq" — bazadagi faol chegirmalar.

## Dizayndan ekran ko'chirish (faqat marketing sahifalari)
1. `npm run design:gen -- <ID> <namespace> --messages=messages/uz.json` — `design/screens/<ID>.html` dan komponentlar
   yaratadi (`scripts/design-maps/<ID>.json` xaritasi bo'yicha): o'lchamlar inline `style` da aynan ko'chiriladi, ranglar
   `var(--color-*)` tokenlariga almashadi, matnlar `messages/uz.json` ga tushadi. Token yo'q rang chiqsa — avval
   `globals.css` ga qo'shing. Mavjud faylni qayta yozmaydi (`--force` kerak).
2. Dinamik qismlar (`{{…}}`, sc-for, sc-if, holat, havolalar) qo'lda tugallanadi.
3. Sahifa ildiziga `className="dz"` qo'yiladi: dizayn brauzer standart uslublari (content-box, standart margin) ustida
   chizilgan, `dz` esa Tailwind preflight'ni shu doirada bekor qiladi. `<button>` ni `<a>`/`<Link>` ga almashtirsangiz
   `boxSizing: "border-box"` qo'shing (tugma standart bo'yicha border-box).
4. `npm run design:compare -- <ID> <yo'l> 1440` va `… 390` — dizayn va sahifani yonma-yon `.compare/` ga chiqaradi,
   farq foizi va farqli qatorlarni ko'rsatadi (`--click`, `--designClick` — holatlar uchun). Farq sababini
   `npm run design:probe -- <ID> <yo'l> <kenglik> "<matn>"` bilan toping. Balandliklar teng va farq ~0.05% dan kam
   bo'lmaguncha ekran tugagan hisoblanmaydi; natija rasmlari foydalanuvchiga ko'rsatiladi.
   Git Bash'da `/` yo'li buzilmasligi uchun `MSYS_NO_PATHCONV=1` qo'ying.

Shrift oilalari `globals.css` da to'g'ridan-to'g'ri yozilgan (`"Archivo", system-ui`): next/font o'zgaruvchisi zanjirga
"Archivo Fallback" qo'shadi va shriftda yo'q belgilar (→, ✶) dizayndagidan farq qiladi. Shrift sozlamasi o'zgarsa
dev serverni qayta ishga tushirish kerak.

Manzillar: `/` landing · `/huquqiy/{maxfiylik|shartlar|biznes}` · `/kirish` · `/talaba/royxat` · `/chegirmalar` ·
`/profil` · `/biznes`, `/biznes/royxat`, `/biznes/chegirmalar/yangi` · `/admin`.

## Kod qoidalari
- Server Component — standart; `"use client"` faqat interaktivlik uchun.
- Mutatsiyalar — server action, kirish zod bilan tekshiriladi. Har bir action va sahifa
  boshida rol tekshiruvi (`requireRole`). Middleware'ga ishonib qolinmaydi.
- Matnlar faqat `messages/uz.json` da. Komponentda qattiq yozilgan o'zbekcha matn bo'lmaydi.
- Pul — butun so'm (Int). Format: "26 600 so'm" (bo'sh joy bilan). Vaqt — UTC saqlanadi,
  Asia/Tashkent'da ko'rsatiladi; chegirma kunlari/soatlari Toshkent vaqtida hisoblanadi.
- Telefon E.164 (`+998XXXXXXXXX`) saqlanadi.
- Guvohnoma va biznes hujjatlari — faqat private bucket; hech qachon public URL emas.
  Faqat admin, qisqa muddatli presigned URL orqali, har bir ko'rish audit log'ga yoziladi.
- QR/redeem mantig'iga tegilsa — testlar majburiy (pastdagi ro'yxat).
- Rang uchun ixtiyoriy qiymat (`text-[#abc]`, inline hex) yozilmaydi — token qo'shiladi. Dizayndan ko'chirilgan
  ekranlarda o'lchamlar inline `style` da qoladi (aniqlik uchun); umumiy primitivlar (`components/ui`) Tailwind'da.

## Kirish va ruxsatlar
- Kirish: telefon → 6 raqamli SMS kod (5 daqiqa amal qiladi; bazada faqat HMAC). Faqat +998 raqamlar.
  Raqam ro'yxatda bor-yo'qligi kod so'rashda oshkor qilinmaydi.
- SMS chegaralari (`otp-rules.ts`): bitta raqamga 60 soniyada 1 ta va kuniga 5 ta; bitta IP'dan soatiga 10 ta so'rov
  (IP bazada faqat xesh ko'rinishida). 5 ta noto'g'ri urinish → kod bekor, raqam 15 daqiqa bloklanadi.
  Qoidalar o'zgarsa uchala qatlamdagi testlar yangilanadi: `otp-rules.test.ts`, `otp.itest.ts`, `e2e/auth.spec.ts`.
- `OTP_FIXED_CODE` faqat `.env.development` da va sinov serverida (`APP_ENV=staging`). `NODE_ENV=production` da `OTP_FIXED_CODE`, `SMS_PROVIDER=dev` yoki
  provayder/sir yo'qligi topilsa server start'da jarayon xato bilan to'xtaydi (`instrumentation-node.ts`, `env-check.ts`).
- Bloklash faqat `src/server/moderation.ts` orqali: holat va barcha sessiyalarni yopish bitta tranzaksiyada
  (biznes bloklansa — egasi va barcha kassirlari). Holatni to'g'ridan-to'g'ri `update` bilan o'zgartirmang.
- Auth cookie'lari: httpOnly, SameSite=Lax, Secure (faqat `next dev` da o'chiq) — `cookie-options.ts`.
- Kod to'g'ri, hisob yo'q → raqam imzolangan cookie'da 30 daqiqa "tasdiqlangan" deb saqlanadi (`getVerifiedPhone`)
  va ro'yxat formasiga o'tiladi; ro'yxat formalari shu raqamga tayanadi.
- Sessiya: tasodifiy token httpOnly cookie'da, bazada SHA-256 xeshi, 30 kun. Bloklangan foydalanuvchi sessiyasi darhol o'ladi.
- `requireRole(...)` — har bir himoyalangan sahifa, layout (`RoleGate`) va server action boshida. Kirmagan → `/kirish`,
  begona rol → o'z bosh sahifasi (`homePathFor`). Proxy (middleware) faqat til uchun.
- Cookie o'qiydigan server komponentlar `<Suspense>` ichida turadi (Cache Components talabi). Dinamik sahifa
  o'z `<Suspense>` chegarasiga ega bo'lsin (`export default` → `<Suspense><…Content/></Suspense>`): mijoz tomonidagi
  o'tishda umumiy layout'dagi chegara ishlamaydi va o'tish bloklanadi.
- `router.push/replace` dan keyin darhol `router.refresh()` chaqirmang — u o'tishni bekor qilishi mumkin.
- Lokal `prisma dev` (PGlite) parallel ulanishlarda so'rovlarni aralashtiradi (`08P01`, "Server has closed the
  connection") — `.env` da `DATABASE_POOL_MAX=1`. Production'da qo'yilmaydi.
- E2E da `withDb` lokal PGlite bilan: test tugashi bilan ~10 soniya yangi ulanish uzilishi mumkin (ECONNRESET) —
  `withDb` 20 soniyagacha qayta urinadi. Dinamik segmentli sahifalarda (`[id]`, `[token]`) `params` faqat Suspense
  ichida o'qiladi (aks holda "blocking-prerender-runtime").
- Formalar `onSubmit` emas, `action={fn}` bilan ulanadi: sahifa ulanmasdan bosilgan yuborish GET bo'lib ketmaydi.
- E2E (`npm run test:e2e`): lokal baza + seed + `.env` da `OTP_FIXED_CODE=000000` kerak. Yangi himoyalangan sahifa
  qo'shilsa `e2e/auth.spec.ts` dagi rol matritsasiga kiritiladi. Admin kirishi SMS + parol (pastda "Admin paroli").

## Fayllar (guvohnoma, hujjatlar)
- Faqat `storage()` (`src/server/storage`) orqali; hozir lokal disk (`.data/private`), R2 shu interfeysga ulanadi.
  Vercel'da lokal disk ishlamaydi (fayllar yo'qoladi) — deploy'dan oldin R2 kerak.
- Saqlashdan oldin har bir fayl `sanitizeDocument` dan o'tadi: rasmlar (JPG/PNG/HEIC) qayta kodlanadi — EXIF, GPS,
  XMP qolmaydi, yo'nalish qo'llanadi, 2560px gacha, 50 Mpx dan katta rad etiladi; HEIC → JPEG. PDF: hujjat
  ma'lumotlari va XMP obyektlari o'chiriladi; **PDF ichidagi rasmlarning EXIF'i tozalanmaydi** (ma'lum cheklov).
  Ochib bo'lmaydigan fayl — `bad_type`. Mavjud/seed fayllar: `npm run files:sanitize`.
- Tur mazmundan aniqlanadi (`sniffType`: JPG/PNG/HEIC/PDF), 10 MB (oqim o'qilayotganda ham); kalit faqat o'zimiz yaratgan qismlardan
  (`verifications/<userId>/<uuid>.<ext>`), foydalanuvchi bergan nom faqat ko'rsatish uchun saqlanadi.
- Faylni beradigan har bir manzil ruxsatni o'zi tekshiradi; public manzil yo'q.
- Yuklash: `POST /api/talaba/guvohnoma` — sessiya (talaba) yoki 15 daqiqalik `x-upload-token`
  (kompyuter → telefon QR o'tkazmasi; faqat yuklashga ruxsat beradi, sessiya bermaydi).
- Lokal tekshiruv uchun tayyor foydalanuvchilar: `node scripts/compare-fixtures.mjs` (`--cookie=tp_session=cmp-…`).

## Admin tekshiruvi (A2)
- `/admin/talabalar?id=…`, `/admin/bizneslar?id=…`; navbat eskisi tepada; qarordan keyin keyingi ariza ochiladi.
- Talabani tasdiqlashda admin guvohnoma № va amal muddatini rasmdan kiritadi (bitta raqam — bitta hisob,
  muddat bugundan oldin va 7 yildan uzoq bo'lmasin). Rad etish sababi talabaga ko'rinadigan matn sifatida saqlanadi.
- Bloklash faqat `moderation.ts` orqali (sessiyalar bilan birga); tugma `confirm` so'raydi.
- Fayllar: `/api/admin/fayl/{guvohnoma|hujjat}/<id>` — faqat admin (boshqalarga 404), `no-store`, har bir so'rov
  `AuditLog` ga `file.view` (kim, qaysi fayl, `maqsad`). `<img>` ko'rsatilishi ham ko'rish hisoblanadi.
- Har bir qaror `AuditLog` da: `student.approve|reject`, `user.block`, `business.approve|reject|block`.
- Dizaynda chizilmagan: guvohnoma №/muddat uchun kiritish maydonlari, PDF ko'rinishi, biznes rad etish sabablari ro'yxati.
- Chegirmalar navbati `/admin/chegirmalar?id=…` (dizaynda yo'q, A2 kartasi va jadvalidan): `PENDING_REVIEW` → tasdiqlash
  (`ACTIVE`) yoki rad etish (sabab matni biznes ro'yxatida ko'rinadi). Audit: `discount.approve|reject`.
  Navbatda "Biznes tekshiruvda" belgisi — biznes tasdiqlanmaguncha chegirma talabaga chiqmaydi.

## Biznes arizasi (B1 / WB1)
- `/biznes/royxat` (kirmagan) → 1-qadam ma'lumot, 2-qadam STIR/mas'ul/telefon/fayllar/rozilik → SMS kod →
  hisob va ariza (`submittedAt = null`) → fayllar `POST /api/biznes/hujjat?tur=registration|photo|logo` →
  `submitBusiness` (`submittedAt = now`). Telefonda STIR 1-qadamda (B1), vebda 2-qadamda (WB1).
- Admin navbatida faqat `PENDING` **va** `submittedAt` bor arizalar. Yarim yo'lda qolgan yoki rad etilgan ariza
  egasining `/biznes` sahifasida forma bo'lib ochiladi (tuzatib, qayta yuboradi); tekshiruvdagisi o'zgarmaydi.
- Qoidalar `src/lib/business.ts` (forma va server bitta); STIR yagonaligi — bazada (`isUniqueViolation`).
  Guvohnoma bitta (yangisi almashtiradi), joy fotolari 1–3 ta, logotip va foto — faqat rasm. Rozilik `AuditLog`
  ga shartlar versiyasi bilan (`business.submit`). Tuman manzildagi nomdan aniqlanadi (aniq bo'lmasa — bo'sh).
- Bitta raqam — bitta rol: talaba raqami bilan biznes ochib bo'lmaydi (`phoneInUse`).
- Dizayndan chetlanishlar: soliq bazasi tekshiruvi yo'q (STIR ostidagi yashil yozuv chiqmaydi); B1 da 7-tur
  "Ko'ngilochar" ham bor; B1 2-qadami va mobil "tekshiruvda" ekrani chizilmagan (WB1 bloklaridan); WB1 3-qadamda
  muhr sarlavha qatorida (dizayndagi mutlaq joylashuv tor kenglikda matnni yopardi), "Orqaga" nofaol.

## Talaba holatlari
`DRAFT → PENDING → APPROVED | REJECTED`, `APPROVED → EXPIRED` (muddat). Yo'naltirish `studentPathFor` da;
ilova sahifalari `requireActiveStudent()`, ro'yxat qadamlari `requireStudent()` chaqiradi.

## Biznes qoidalari

**Kupon va QR (offline TOTP).**
- Olish — online, tranzaksiyada: talaba faol, chegirma `ACTIVE` va hozir ochiq, kunlik qoldiq va
  talaba limiti bor → `DiscountDay.claimed + 1`, `Coupon` (10 daqiqa). Qurilmaga kuponga xos
  secret (160 bit), kod va `expiresAt` beriladi.
- Ko'rsatish — offline. Token klientda hisoblanadi (RFC 6238 uslubi, 60s oyna):
  QR = `kuponKodi . oyna . HMAC-SHA256(secret, oyna)` ning 128 biti; ekranda yana 6 raqamli TOTP kod.
  Klient va server bitta `src/lib/totp` kodidan foydalanadi.
- Skan — kassir online: HMAC, oyna (±1), kupon holati/muddati, kassir shu biznesga tegishliligi.
- Qo'lda kiritish — kupon kodi **va** 6 raqamli kod birga. Faqat statik kod hech qachon yetarli emas.
  Kupon boshiga 5 ta xato → qo'lda kiritish yopiladi.
- Tasdiqlash atom: `UPDATE coupon SET status='REDEEMED' WHERE id=? AND status='ACTIVE' AND
  "expiresAt" > now()` + `Redemption.couponId UNIQUE`.
- Bekor qilish / eskirish bitta funksiyadan: `UPDATE … WHERE status='ACTIVE'` 1 qator o'zgartirsagina
  `DiscountDay.claimed − 1` (shu tranzaksiyada). Eskirganlar cron bilan va har "olish" oldidan lazy tozalanadi.
- Har bir muvaffaqiyatsiz urinish `ScanAttempt` ga yoziladi.
- Majburiy testlar: takror skan, eskirgan oyna, ±1 oyna, noto'g'ri secret, muddati o'tgan kupon,
  kunlik/talaba limiti, parallel tasdiqlash, begona biznes kassiri, qo'lda kiritish (6 raqamsiz rad,
  5 xatoda yopilish), qoldiq qaytishi (bir marta, ikki marta emas, sotilgani qaytmaydi,
  eskirish↔tasdiqlash poygasi), klient va server tokenlari tengligi.

**Chegirma moderatsiyasi.** `DRAFT → PENDING_REVIEW → ACTIVE | REJECTED`. Talabaga faqat `ACTIVE`
(va biznesi `APPROVED`) ko'rinadi. Tasdiqlangan chegirmada mazmun (nom, tur, narx/foiz, shartlar)
o'zgarsa qayta `PENDING_REVIEW`; to'xtatish/yoqish, kunlik son, kun/soat oralig'i — tekshiruvsiz.

Chegirma muharriri (B2 / WB2): `/biznes/chegirma/yangi`, `/biznes/chegirma/<id>`; ro'yxat `/biznes/chegirmalar`.
Server — `src/server/business/discounts.ts` (`saveDiscount`, `setDiscountActive`); forma va server bitta
`validateDiscount`. Chegirma faqat arizasi yuborilgan (bloklanmagan/rad etilmagan) biznesda. Kategoriya biznes
turidan (`CATEGORY_BY_KIND`). Forma matnlari dizayndagidek ("38 000", "60 ta", "13.10 – 31.10") — `parseAmount`,
`parseDateRange`. WB2 maslahati — oxirgi 60 kunlik sotuvlardan (20 tadan kam bo'lsa ko'rsatilmaydi).
Chetlanishlar: chegirma rasmi ("+" belgisi) 7-bosqichda; WB2 oldindan ko'rishda masofa yo'q; kabinetda "Chiqish".

**Kassirlar.** Taklif — `/kassir/<token>`: tasodifiy token (bazada SHA-256), 48 soat, bir marta (`acceptedAt IS NULL`
sharti bilan atom), faqat tasdiqlangan biznes taklif qiladi, ochiq takliflar ≤ 10. Bitta raqam — bitta rol, kassir bir
vaqtda bitta biznesda. Kassirning biznesi faqat `cashierBusiness(userId)` dan (faol a'zolik, bloklanmagan biznes).
Egasi o'chirsa: a'zolik `active=false` + kassirning barcha sessiyalari o'chiriladi; `getCurrentUser` ham a'zoligi yo'q
kassirni qaytarmaydi; kirishda `noBusiness`. B5: `/biznes/profil` (dizayn), `/biznes/kassirlar`; "Smenada" — oxirgi
skan 60 daqiqa ichida. Dizayndan chetlanish: kassir qatorida "×" (o'chirish), taklif havolasi bloki, qabul sahifasi.

**Talaba tasdig'i muddatli.** Admin tasdiqlashda guvohnoma № va `cardExpiresAt` ni kiritadi.
Muddat o'tsa talaba `EXPIRED`: yangi guvohnoma yuklashga yo'naltiriladi, chegirma ololmaydi, tarixi
saqlanadi. Tekshiruv har so'rovda (`requireActiveStudent`) va kupon olishda — cron'ga tayanilmaydi.

## Sinov serveri (staging)
- Havola: https://talabapass.vercel.app — alohida Neon baza va alohida private bucket. `APP_ENV=staging`
  (build vaqtida ham kerak — o'zgartirilsa Redeploy).
- Sayt hammaga ochiq (Basic Auth yo'q): landing, talaba, biznes. `APP_ENV=staging` da: `X-Robots-Tag` + `robots` meta
  noindex, "Sinov versiyasi" belgisi (`StagingBadge`, dizaynda yo'q), SMS/Telegram ulanguncha `OTP_FIXED_CODE` va
  `SMS_PROVIDER=dev` ruxsat (`devShortcutsAllowed`). Start'da `STORAGE_DRIVER=s3` majburiy.
  `APP_ENV` yo'q/boshqa qiymat — production qoidalari o'zgarmagan (`env-check.test.ts`).
- Fayllar: `STORAGE_DRIVER=s3` (`storage/s3.ts`) — R2 yoki Supabase S3 endpoint, path-style.
- Vercel build: `vercel-build` = `check-env` → `prisma migrate deploy` → `next build`. Muhit xato bo'lsa deploy
  aniq xabar bilan to'xtaydi (aks holda runtime'da `MIDDLEWARE_INVOCATION_FAILED`). Migratsiya `DATABASE_URL_UNPOOLED` orqali.
  Seed: `.env.staging` to'ldirib `npm run staging:seed`.
- `proxy.ts` da faqat Edge'ga mos kod: `node:*`, baza, `src/server` importi yo'q (Vercel'da alohida funksiya).
- Ma'lum cheklov: Vercel so'rov tanasi ≤ 4.5 MB — undan katta guvohnoma/hujjat yuklanmaydi (presigned yuklash keyin).

## Admin paroli (ikkinchi qadam, production'da ham)
- Admin: telefon → SMS kod → `/kirish/admin` da parol. Xesh `ADMIN_PASSWORD_HASH` env'da (`npm run admin:hash`,
  scrypt, `scrypt:N:r:p:salt:hash`); xesh yo'q/buzilgan bo'lsa admin umuman kira olmaydi.
- To'g'ri parol → `tp_admin` cookie: HMAC, joriy sessiya tokeniga bog'langan, 12 soat. Chiqish/bloklash bilan o'ladi.
- `requireRole` parolsiz adminni `/kirish/admin` ga yuboradi (barcha sahifa, layout, action); API — `getUnlockedAdmin()`
  (parolsiz 404). Yangi admin API shu funksiya bilan yoziladi.
- 5 ta xato (15 daqiqa ichida) → admin sessiyalari yopiladi, 15 daqiqa parol qabul qilinmaydi. Har urinish
  `AuditLog`: `admin.password.ok|fail`. Testlar: `admin-password.test.ts`, `e2e/admin-password.spec.ts`.
- Lokal: `.env.development` dagi xesh, parol `dev-admin-parol` (`e2e/helpers.ts` → `signIn` o'zi kiritadi).

## Ishga tushishdan oldin (majburiy ro'yxat)
Production'ga chiqishdan oldin har biri bajarilgan yoki ongli ravishda qoldirilgan bo'lishi kerak:
- [ ] **Admin uchun TOTP ikkinchi faktor** (authenticator ilova): hozir SMS + umumiy parol (`ADMIN_PASSWORD_HASH`);
      har admin uchun alohida TOTP va zaxira kodlar — keyin.
- [ ] SMS provayder (Eskiz.uz yoki boshqa) ulangan; `SMS_PROVIDER=dev` va `OTP_FIXED_CODE` yo'q (server baribir ishga tushmaydi).
- [ ] Fayllar Cloudflare R2'da (lokal disk Vercel'da ishlamaydi); bucket private.
- [ ] Ma'lumotlarni saqlash joyi va W3 matni ("O'zbekiston hududidagi serverlar") — yurist bilan kelishilgan.
- [ ] Huquqiy matnlardagi `[EMAIL]`, `[STIR]`, `[TARIF MA'LUMOTI]`, `[N] kun` va h.k. to'ldirilgan.
- [ ] Guvohnoma rasmlari tekshiruvdan keyin `[N]` kunda o'chiriladi (siyosatda va'da qilingan) — cron.
- [ ] `pruneOtpData` va eskirgan kuponlarni yopish cron'lari ulangan.
- [ ] PDF ichidagi rasmlarning EXIF'i tozalanmaydi — PDF'ni rasmga aylantirish yoki shu cheklovni qabul qilish.
- [ ] Rate limit IP'si: hosting `x-forwarded-for` ni o'zi yozishini tekshirish (Vercel — ha).

## Ochiq masalalar
- W3 matnida "ma'lumotlar O'zbekiston hududidagi serverlarda saqlanadi" deyilgan, hosting esa
  Vercel/Neon/R2. Production'gacha yurist bilan hal qilinadi; matn o'zboshimchalik bilan o'zgartirilmaydi.
- To'ldirilmagan joylar: `[EMAIL]`, `[TELEFON RAQAM]`, `[MANZIL]`, `[YURIDIK SHAXS NOMI]`, `[STIR]`,
  `[TARIF MA'LUMOTI]`, `[N] kun` — egasidan kutilmoqda, o'ylab topilmaydi.
- SMS: hozircha dev rejim (kod server log'iga chiqadi), provayder adapter orqali keyin ulanadi.
- 6 raqamli TOTP kod va admin'dagi "Chegirmalar" navbati dizaynda chizilmagan — mavjud uslubda qo'shiladi.
