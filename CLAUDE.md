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
npm run test:e2e:live  navigatsiya testi jonli havolada (`.env.staging` bazasi + E2E_BASE_URL; faqat GET, `E2E_ADMIN_PASSWORD` bo'lsa admin ham)
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

Shriftlar: Archivo (variable, `wdth` o'qi majburiy) — `next/font` orqali self-host. Mono shrift yo'q: `--font-mono` ham Archivo, raqamlar `tabular-nums` (design/ dagi Plex Mono faqat manba).
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

Landing'dagi ma'lumotlar bazadan (`src/server/landing.ts`, har biri o'z `<Suspense>` ida):
- Statistika (jami tejalgan summa bilan) — `STATS_MIN` (`src/lib/landing.ts`) dan kichik bo'lsa bo'lim yashiriladi.
- Hamkorlar — tasdiqlangan bizneslar (APPROVED/WARNED); oliygohlar — tasdiqlangan talabasi borlari.
- "Hozir Toshkentda ochiq" — talabaga ko'rinadigan chegirmalar (avval ochiqlari).

## Talaba lentasi (T4 / WT2, T5 / WT3)
- Ko'rinish qoidasi bitta joyda: `visibleDiscountWhere` (`src/server/student/feed.ts`) — `ACTIVE`, biznes APPROVED/WARNED,
  egasi bloklanmagan, muddat tugamagan. Holat/keyingi ochilish — `dealTiming` (`src/lib/time.ts`), qoldiq — oraliq kunidagi
  `DiscountDay.claimed`. Filtr/saralash brauzerda (`src/lib/feed.ts`), URL'da saqlanadi; sahifa har daqiqa yangilanadi.
- Joy (`tp_loc` cookie): tuman markazi yoki geolokatsiya (~100 m); masofa shundan. Xarita — MapLibre + OpenFreeMap (kalitsiz).
- **Lenta B · Jurnal** (`design/talabaPass – Lenta B · Jurnal (1).html`, T4/WT2 kartalari va T5/WT3 rasm qismi): `FeedCard` (`ui/feed-card.tsx`) — 210px rasm,
  tepada yorliq (`DealTag`: "Tez tugaydi · 2/20" qora fonda, "Ertaga 08:00" oq fonda), o'ngda foiz (`PctBadge`: −30%, 1+1), pastda narx plitkasi;
  holatlar `useDealMarks` da. Rasmsiz karta — katta bosh harf + "Rasm kutilmoqda" (dizayndagi noImg). Telefon lentasi sarlavhasi
  "Bugun arzon.", tagchiziqli qidiruv, `CategoryPill` chiplari. Dizayndan chetlanishlar (ruxsat berilgan): "Tez tugaydi" gorizontal qatori telefonda yo'q
  (yorliq o'rnini bosadi), vebda qoldi; sarlavhada xarita va qo'ng'iroq tugmalari, sana yonida vaqt; "Yaqinidan" o'rniga saralashga mos yozuv;
  rasmsiz kartadagi bosh harf kategoriya siyohining 14% shaffofligi (alohida "plita" rangi yo'q); tafsilotda yorliq rasmning yuqori chap burchagida,
  foiz — pastki o'ngda (telefon) / yuqori o'ngda (veb); narx bloki o'zgarmagan.
- Kategoriya chiplari — karusel (`student/feed/category-chips.tsx`): o'zi sekin aylanadi (24 px/s, chiplar nusxasi bilan cheksiz); tegish, hover, g'ildirak, fokus,
  sahifa/lenta siljishi yoki surish — to'xtaydi va qayta aylanmaydi (nusxa olib tashlanadi, oddiy surish qoladi); kursorli qurilmada ← → tugmalari;
  `prefers-reduced-motion` da aylanmaydi. Vebda (WT2) yon paneldagi kategoriya ro'yxati o'rniga shu karusel (dizaynda chizilmagan).
- Dizayndan chetlanishlar: xarita ekrani chizilmagan (primitivlardan);
  qo'ng'iroq faqat belgi;
  `/profil` — T8/WT4 (pastdagi "Profil" bo'limi).

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
`/profil` · `/kuponlar` · `/tarix` · `/biznes`, `/biznes/royxat`, `/biznes/chegirmalar/yangi`, `/biznes/skaner` · `/admin`.

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

## Orqaga (navigatsiya)
- `ui/back-button.tsx`: `BackLink` (ota sahifaga) va `BackButton` (holat qadamiga); `round` (telefon sarlavhasi) va `text` ("← Orqaga") ko'rinishlari. Dizaynda chizilmagan joylarga qo'shilgan.
- Qadamlar holatda bo'lgan formalar (kirish, talaba va biznes ro'yxati — kod qadami ham) `useStepHistory` (`src/lib/use-step-history.ts`) dan foydalanadi:
  har yangi qadam brauzer tarixiga yoziladi, telefon/brauzer "orqaga" oldingi qadamga qaytaradi; 1-qadamda ← bosh sahifaga. Hook holat hook'ida chaqiriladi (telefon va veb ko'rinishi DOM'da ikkalasi turadi — bir marta).
- Sahifa tuzilmasi ← : sotuvlar/kassirlar (telefon), chegirma muharriri (veb), profil tahriri/guvohnomasi (veb), admin paroli. Mavjud "orqaga"li ekranlar o'zgarmagan.
- Test: `e2e/back-navigation.spec.ts`.

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
  Joyi: `src/lib/totp.test.ts` (RFC 6238 vektorlari bilan), `src/server/coupons/coupons.itest.ts`,
  `e2e/coupon.spec.ts`, `e2e/scanner-camera.spec.ts` (soxta kamera oqimidagi QR'ni skaner o'qiydi).

**QR oqimi — kod xaritasi (8-bosqich).**
- `src/lib/totp.ts` — QR va 6 raqamli kod (Web Crypto, klient=server). `src/server/coupons/coupons.ts` — olish,
  `closeCoupon` (bekor/eskirish — yagona joy), `expireDueCoupons` (lazy + `/api/cron/kuponlar`, `CRON_SECRET`),
  secret AES-256-GCM (kalit `AUTH_SECRET` dan). `scan.ts` — `scannerFor` (biznes faqat sessiyadan), `scanCoupon`
  (har urinish `ScanAttempt`, OK ham), `confirmRedemption` (5 daqiqalik imzolangan "ticket" + atom UPDATE).
  `receipts.ts` — chek ma'lumoti, tarix, PDF (pdf-lib standart shrift: `pdfSafe` "−", "ʻ", "№" ni almashtiradi).
- Sahifalar: T6 `/kuponlar/<id>` (bitta faol bo'lsa `/kuponlar` shunga o'tadi), WT3 yon panelda QR, B3/B4
  `/biznes/skaner` (egasi ham), T7/WT4 `/tarix?oy=&chek=`, PDF `/api/chek/<id>` (talaba, egasi, kassir, admin).
- Talaba ekrani internet bo'lsa 4 s da sotilganini so'raydi va chekka o'tadi; QR internetsiz yangilanadi.
  Sahifani internetsiz ochish — PWA (pastdagi "PWA" bo'limi).
- Kamera: BarcodeDetector, bo'lmasa jsQR; chiroq (torch) qo'llansa tugma chiqadi.
- Dizayndan chetlanishlar: QR ostida 6 raqamli kod; "Kodni kiritish" formasi; narxsiz chegirmada kassir chek summasini
  (1+1 — bitta mahsulot narxini) kiritadi; kassirda pastki navigatsiya o'rniga "Hisobdan chiqish"; T7 da PDF havolasi;
  bir nechta faol kupon ro'yxati; WT4 menyusida "Shaxsiy ma'lumotlar", "Talaba guvohnomasi" hozircha havolasiz;
  skan xatolari qizil blokda.

**Chegirma moderatsiyasi.** `DRAFT → PENDING_REVIEW → ACTIVE | REJECTED`. Talabaga faqat `ACTIVE`
(va biznesi `APPROVED`) ko'rinadi. Tasdiqlangan chegirmada mazmun (nom, tur, narx/foiz, shartlar)
o'zgarsa qayta `PENDING_REVIEW`; to'xtatish/yoqish, kunlik son, kun/soat oralig'i — tekshiruvsiz.

Chegirma muharriri (B2 / WB2): `/biznes/chegirma/yangi`, `/biznes/chegirma/<id>`; ro'yxat `/biznes/chegirmalar`.
Server — `src/server/business/discounts.ts` (`saveDiscount`, `setDiscountActive`); forma va server bitta
`validateDiscount`. Chegirma faqat arizasi yuborilgan (bloklanmagan/rad etilmagan) biznesda. Kategoriya biznes
turidan (`CATEGORY_BY_KIND`). Forma matnlari dizayndagidek ("38 000", "60 ta", "13.10 – 31.10") — `parseAmount`,
`parseDateRange`. WB2 maslahati — oxirgi 60 kunlik sotuvlardan (20 tadan kam bo'lsa ko'rsatilmaydi).
Chetlanishlar: WB2 oldindan ko'rishda masofa yo'q; kabinetda "Chiqish".
Rasmlar (`discount-images.ts`): 4 tagacha, faqat rasm, `sanitizeDocument` dan; kalit `discounts/<id>/<uuid>.<ext>`.
Muharrir fayllarni saqlashdan keyin yuklaydi (`POST /api/biznes/chegirma-rasm?chegirma=`, `DELETE ?rasm=`). Tasdiqlangan
chegirmada rasm qo'shilsa/o'chirilsa — qayta `PENDING_REVIEW`. Ko'rish: `/api/chegirma/rasm/<id>` — talabaga ko'rinadigan
chegirmaniki hammaga (landing ham), aks holda faqat egasi va admin (boshqalarga 404). Rasm qatori dizaynda chizilmagan.

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
  noindex (ko'rinadigan belgi yo'q), SMS/Telegram ulanguncha `OTP_FIXED_CODE` va
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
  Env qiymati tozalanadi (`normalizeAdminHash`: prefiks, qo'shtirnoq, satr bo'linishi); xesh yaroqsiz bo'lsa formada
  "sozlanmagan" xabari (urinish hisoblanmaydi) va `vercel-build` deploy'ni to'xtatadi (`buildEnvProblems`).
- To'g'ri parol → `tp_admin` cookie: HMAC, joriy sessiya tokeniga bog'langan, 12 soat. Chiqish/bloklash bilan o'ladi.
- `requireRole` parolsiz adminni `/kirish/admin` ga yuboradi (barcha sahifa, layout, action); API — `getUnlockedAdmin()`
  (parolsiz 404). Yangi admin API shu funksiya bilan yoziladi.
- 5 ta xato (15 daqiqa ichida) → admin sessiyalari yopiladi, 15 daqiqa parol qabul qilinmaydi. Har urinish
  `AuditLog`: `admin.password.ok|fail`. Testlar: `admin-password.test.ts`, `e2e/admin-password.spec.ts`.
- Lokal: `.env.development` dagi xesh, parol `dev-admin-parol` (`e2e/helpers.ts` → `signIn` o'zi kiritadi).

## Admin: umumiy, tranzaksiyalar, bloklanganlar, bildirishnomalar (10-bosqich)
- Yon panel to'liq: `/admin` (A1) · `/admin/talabalar` · `/admin/bizneslar` · `/admin/chegirmalar` · `/admin/tranzaksiyalar` ·
  `/admin/bildirishnomalar` (A3) · `/admin/bloklanganlar`. Admin kirgach `/admin` ga tushadi (`homePathFor`). Reja: `docs/10-bosqich-reja.md`.
- A1: `src/server/admin/overview.ts` (Toshkent kunlari, 30 kun), sof mantiq `src/lib/admin-stats.ts` (kategoriya ulushi yig'indisi aniq 100,
  yumaloq o'q). Reytingdan "Bloklash" — mavjud `blockBusinessAction`. Qidiruv maydoni `/admin/tranzaksiyalar?q=` ga o'tadi.
- Tranzaksiyalar: `Redemption` + rad etilgan `ScanAttempt` (natija ≠ OK) bitta ro'yxatda, filtr URL'da (`holat`, `davr`, `q`, `sahifa`,
  `src/lib/admin-transactions.ts`); Excel — `/api/admin/tranzaksiyalar/eksport` (`getUnlockedAdmin`, audit `transactions.export`).
- Bloklanganlar: `moderation.ts` da `unblockUser`/`unblockBusiness` (talaba: muddati o'tmagan → APPROVED, o'tgan → EXPIRED, hech
  tasdiqlanmagan → REJECTED; biznes: ilgari tasdiqlangan → APPROVED, aks holda PENDING). Audit `user.unblock`, `business.unblock`.
- Bildirishnomalar: `src/server/notifications/` — `audience.ts` (ALL_STUDENTS, UNIVERSITY, DISTRICT, BUSINESSES), `send.ts` (yaratish,
  atom `SCHEDULED→SENDING`, `dispatchDue`), `push.ts` (Web Push, VAPID), `direct.ts` (tasdiq/rad xabari: ilova ichi + push + SMS),
  `inbox.ts`. Qoidalar `src/lib/notifications.ts` (sarlavha ≤ 50, matn ≤ 150, vaqt Toshkent, ≤ 90 kun).
  `Audience.USER` — tizim xabari, admin tarixida ko'rinmaydi. **DISTRICT**: talabaning profilidagi ixtiyoriy `StudentProfile.districtId`
  (tumanni ko'rsatmagan talaba hech bir hududga kirmaydi). "Ochildi" — `UserNotification.readAt` dan hisoblanadi.
- Talaba qo'ng'irog'i → `/bildirishnomalar`, biznes egasi → `/biznes/bildirishnomalar` (push yoqish tugmasi shu yerda, `public/sw.js`).
- Rejalashtirilgan xabarlar: Vercel Hobby cron'i kuniga 1 marta — shuning uchun asosiy yo'l GitHub Actions (`.github/workflows/cron.yml`, har 5 daqiqa,
  `/api/cron/bildirishnomalar`, `Authorization: Bearer CRON_SECRET`; repo secrets `CRON_SECRET`, `APP_URL`), zaxira — `vercel.json` kunlik cron va
  admin sahifasi ochilganda `dispatchDue`. Endpoint idempotent.
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`npm run push:keys`); uchalasi birga yoki hech biri (`env-check`). Kalitlarni
  almashtirsangiz push obunalari ishlamaydi.
- Dizayndan chetlanishlar: A1 dagi tranzaksiyalar jadvali alohida sahifada; "Bloklanganlar" sahifasi, `/bildirishnomalar` sahifalari dizaynda yo'q
  (mavjud primitivlardan); A3 da "2-moderator tasdiqlaydi" izohi yo'q (bunday jarayon yo'q), "Ertaga 08:30" o'rniga "Rejalashtirish" + vaqt maydoni;
  A1 qidiruvi tranzaksiyalarga olib boradi.
- Testlar: `admin-stats.test.ts`, `admin-transactions.test.ts`, `notifications.test.ts`, `admin.itest.ts`, `notifications.itest.ts`,
  `moderation.itest.ts` (blokdan chiqarish), `e2e/admin-overview.spec.ts`.

## Harakat (animatsiya) va toast
- Tokenlar `globals.css`: `--ease-out` (0.23,1,0.32,1), `--ease-in-out`, `--ease-drawer`; kirish utilitalari `enter-page` (talaba `template.tsx`, 220ms),
  `enter-rise` (kupon chiptasi/paneli, tasdiq bloki), `enter-focus` (QR — xiralikdan), `enter-print` (chek yuqoridan ochiladi), `skeleton-breathe` (`PageSkeleton`).
  Faqat transform/opacity/clip-path/filter. `prefers-reduced-motion` — global qoida: siljish yo'q, `enter-*` faqat shaffoflik bilan.
- Tugma harakatlari (`design/Tugmalar · hover va bosish animatsiyalari-html`): `buttonClass` orqali, sinflari `globals.css` da — `tp-stamp` (blue/green: hover'da ko'tarilib qora soya, bosganda tushadi), `tp-paint` (outline*: to'q sariq fon chapdan to'ladi), `aria-busy`/`Button loading` — pastda yuguruvchi chiziq. Chip/ToggleSquare/TogglePill/Dropdown — `ui/motion.ts` (`LIFT`), Segmented/ViewSwitch — `PRESS`. `prefers-reduced-motion` da siljish yo'q. Inline `style` li (landing, huquqiy) va Tailwind'siz joylar uchun sinflar: `tp-btn tp-stamp|tp-paint` (tugma), `tp-lift` (chip/ikonka), `tp-card` (bosiladigan blok), `tp-row` (ro'yxat qatori), `tp-link` (matnli havola; `--tp-link-hover`). Orange/ink ham `tp-stamp` (ink — to'q sariq soya). Yangi button/havola shulardan biriga ega bo'lsin. Dizaynning kupon "yirtiladigan dum", stiker belgisi va "uchqun" (saqlash) variantlari ilovada mos tugma yo'qligi uchun qo'llanmagan.
- Bosilish: `Button`/`ButtonLink` `active:scale-[0.97]`, `FeedCard` 0.985, `CategoryPill` 0.96, pastki nav ikonkasi. Tailwind v4 da `translate`/`scale` —
  alohida xususiyat: `transition-[transform]` ularni qamramaydi, `transition-[translate,scale,…]` yozing.
- `Button variant="idle"` — hozir bosib bo'lmaydigan asosiy harakat (`track` fon, `muted` matn; `opacity-50` emas — kontrast).
- Toast: `ui/toast.tsx` — `toast(text, "ok"|"info")`, `<Toaster/>` talaba layout'ida. Ulashish, saqlash, bildirishnoma kaliti, kupon bekor qilish.
- Kupon: bekor qilish `confirm` so'raydi; QR ekranida Screen Wake Lock (`useWakeLock`); sotilganda tebranish va `/tarix?chek=<id>&yangi=1` —
  "Sotuv tasdiqlandi" bloki (`data-testid="redeemed"`) va chek animatsiyasi. Yopiq chegirmada telefon CTA ostida ochilish vaqti.
- Dizaynda chizilmagan: toast, tasdiq bloki, `/kuponlar` bo'sh holati (chipta), `/kuponlar` veb ko'rinishi (WT4 sarlavhasi).

## Profil, PWA, holatlar, navigatsiya testi (11-bosqich)
- Profil: `/profil` (T8 telefon; veb — WT4 yon paneli + "Shaxsiy ma'lumotlar" formasi), `/profil/tahrir`, `/profil/guvohnoma` (faqat ko'rish).
  Umumiy qismlar `src/components/student/profile/` (`StudentIdCard`, `TotalsGrid`, `ProfileAside` — `/tarix` vebida ham shu), server —
  `src/server/student/profile.ts` (+ `profile-data.ts`), action `student-profile.ts`, qoidalar `src/lib/profile.ts` (forma va server bitta, ro'yxat bilan bir xil `NAME`).
  Tahrirlanadi: ism, familiya, kurs, fakultet, tuman (ixtiyoriy, `StudentProfile.districtId`); universitet va guvohnoma ma'lumoti — yo'q.
  Til qatori faqat "O'zbekcha" ko'rsatadi (ru/en tarjimasi yo'q — yolg'on tanlov qo'shilmagan). "Yordam markazi" → landing `/#savollar`.
- Biznes ma'lumotlarini tahrirlash (B5 "Tahrirlash"): `/biznes/profil/tahrir`, `src/server/business/profile-edit.ts`. Nom yoki manzil o'zgarsa
  tasdiqlangan biznes `PENDING` ga qaytadi (chegirmalar talabaga ko'rinmay qoladi, audit `business.edit`); ish vaqti va tavsif — tekshiruvsiz.
- PWA: `public/manifest.webmanifest`, `public/icons/` (`node scripts/pwa-icons.mjs` — "ticket" ikonkasidan), qo'lda yozilgan `public/sw.js`
  (Serwist emas: Next 16/Turbopack da `@serwist/next` ishlamaydi; push mantiqi shu faylda). Faqat production'da ro'yxatdan o'tadi
  (`ServiceWorkerRegister`). `/_next/static` — cache-first; navigatsiya tarmoqsiz bo'lsa `/oflayn`; ochilgan kupon sahifasi (`/kuponlar/<id>`)
  va fayllari keshlanadi (internetsiz ochiladi; QR kliyentda hisoblanadi), `/kuponlar` — eng so'nggi keshlangani. `/kirish` ochilganda kesh
  tozalanadi. SW o'zgarsa `VERSION` ni oshiring. Tekshiruv: faqat `next build && next start` + DevTools → Offline.
- 404 va oflayn ekranlari dizayndan (`design/404.html` ichida 404 desktop/telefon va oflayn): `NotFoundScreen` (`@container`, 700px da desktop↔telefon), `OfflineScreen`; "Qayta urinish" (`RetryButton`) tarmoqni tekshirib sahifani qayta yuklaydi, tarmoq qaytsa o'zi yangilaydi.
- Holatlar: `src/app/[locale]/error.tsx`, `not-found.tsx`, `/oflayn` (`StatePage`), yuklanish — `PageSkeleton` (ilova sahifalarining `<Suspense>` fallback'i;
  landing/kirish'da `null` qoldi). Skelet `animate-pulse` ishlatadi — dizaynda chizilmagan holat.
- `e2e/navigation.spec.ts`: 4 rol + mehmon × 390/1440, ko'rinadigan havolalar 2 qadam chuqurlikda; xato/404, bo'sh, "tez orada" matni, begona bo'limga
  yo'naltirish — xato. Yangi sahifa havola bilan bog'lansa o'zi tekshiriladi. `e2e/profile.spec.ts`, `e2e/business-edit.spec.ts`.
- Dizayndan chetlanishlar: T8 dagi sozlamalar tugmasi "Sozlamalar" ro'yxatiga o'tadi (`#sozlamalar`); WT4 yon panelida "Bildirishnomalar" qatori bosilsa
  almashadi; `/profil/tahrir`, `/profil/guvohnoma`, `/biznes/profil/tahrir`, `/oflayn`, xato/404 ekranlari dizaynda yo'q (mavjud primitivlardan).
- Landing pastki qismidagi ijtimoiy tarmoq belgilarining havolasi `#` — egasidan manzillar kutilmoqda.
- Lokal e2e: `prisma dev` (PGlite) qotib qolsa ("Server has closed the connection", P1017, ECONNRESET, testlar ketma-ket yiqiladi) —
  `npm run db:dev` jarayonini to'xtatib qayta ishga tushiring (ma'lumot saqlanadi). Sinov serverining bazasida e2e yuritilmaydi.
  Qayta ko'tarilmasa ("Lock file is already being held"): `%LOCALAPPDATA%prisma-dev-nodejsDatadurable-streams	alabapass-devserver.lock.lock` papkasini o'chiring. Shu papkadagi
  `durable-streams.sqlite` (Prisma Streams logi, ilovaga kerak emas) ~2 GB gacha o'sib, qotishlarga sabab bo'ldi — `_backup` ga ko'chirib yangidan boshlandi; yana o'ssa shuni takrorlang.

## Ishga tushishdan oldin (majburiy ro'yxat)
To'liq, tushuntirishlar bilan — `docs/ishga-tushirish.md`. Qisqacha:
Production'ga chiqishdan oldin har biri bajarilgan yoki ongli ravishda qoldirilgan bo'lishi kerak:
- [ ] **Admin uchun TOTP ikkinchi faktor** (authenticator ilova): hozir SMS + umumiy parol (`ADMIN_PASSWORD_HASH`);
      har admin uchun alohida TOTP va zaxira kodlar — keyin.
- [ ] SMS provayder (Eskiz.uz yoki boshqa) ulangan; `SMS_PROVIDER=dev` va `OTP_FIXED_CODE` yo'q (server baribir ishga tushmaydi).
- [ ] Fayllar Cloudflare R2'da (lokal disk Vercel'da ishlamaydi); bucket private.
- [ ] Ma'lumotlarni saqlash joyi va W3 matni ("O'zbekiston hududidagi serverlar") — yurist bilan kelishilgan.
- [ ] Huquqiy matnlardagi `[EMAIL]`, `[STIR]`, `[TARIF MA'LUMOTI]`, `[N] kun` va h.k. to'ldirilgan.
- [ ] Guvohnoma rasmlari tekshiruvdan keyin `[N]` kunda o'chiriladi (siyosatda va'da qilingan) — cron.
- [ ] Web Push: `VAPID_*` o'rnatilgan; GitHub Actions secrets (`CRON_SECRET`, `APP_URL`) qo'yilgan — aks holda rejalashtirilgan xabarlar kuniga bir marta ketadi.
- [ ] `pruneOtpData` cron'i ulangan. Kuponlar cron'i `vercel.json` da (kuniga 1 marta) — Vercel'da `CRON_SECRET` qo'yilsin.
- [ ] PDF ichidagi rasmlarning EXIF'i tozalanmaydi — PDF'ni rasmga aylantirish yoki shu cheklovni qabul qilish.
- [ ] Rate limit IP'si: hosting `x-forwarded-for` ni o'zi yozishini tekshirish (Vercel — ha).

## Ochiq masalalar
- W3 matnida "ma'lumotlar O'zbekiston hududidagi serverlarda saqlanadi" deyilgan, hosting esa
  Vercel/Neon/R2. Production'gacha yurist bilan hal qilinadi; matn o'zboshimchalik bilan o'zgartirilmaydi.
- To'ldirilmagan joylar (`[EMAIL]` — talabapass@gmail.com bilan to'ldirilgan): `[TELEFON RAQAM]`, `[MANZIL]`, `[YURIDIK SHAXS NOMI]`, `[STIR]`,
  `[TARIF MA'LUMOTI]`, `[N] kun` — egasidan kutilmoqda, o'ylab topilmaydi.
- SMS: hozircha dev rejim (kod server log'iga chiqadi), provayder adapter orqali keyin ulanadi.
- Admin'dagi "Chegirmalar" navbati va kupon ekranidagi 6 raqamli kod dizaynda chizilmagan — mavjud uslubda qo'shilgan.

## Biznes statistikasi (B6, 9-bosqich)
- `/biznes` holatga qarab: forma (yarim yo'lda/rad etilgan) · tekshiruv sahifasi (PENDING) · statistika (APPROVED/WARNED).
  Yuborishdan keyin klient `router.replace("/biznes")` qiladi (action ichida redirect emas).
- Hisob: `src/server/business/stats.ts` (SQL, Toshkent vaqti), sof mantiq `src/lib/stats.ts`. Davr `?davr=1|7|30`.
  "Qayta kelgan" = davrdagi talabalardan shu biznesda davr oxirigacha 2+ xaridi borlari; "yangi" = birinchi xaridi davr ichida.
  Voronka: `DiscountView` (talaba tafsilotni ochganda) → `Coupon` → `Redemption`.
- `/biznes/sotuvlar` (ro'yxat + PDF chek), `/api/biznes/hisobot` (Excel, exceljs, faqat egasi). Testlar: `e2e/business-stats.spec.ts`
  (ko'rsatkichlar mustaqil SQL bilan solishtiriladi), `e2e/business-home.spec.ts`.
- Dizayndan chetlanishlar: B6 telefon ko'rinishi chizilmagan (bloklar ustma-ust); voronkadagi "QR muddatini uzaytiring"
  maslahati yo'q (muddat sozlanmaydi); yon panelda biznes kartasi va "Kassa ilovasi" bloki yo'q; "Skaner" bandi qo'shilgan.

## Sayqal bosqichi (profil rasmi, aloqa, OTM, admin boshqaruvi)
- Profil rasmi: talaba `StudentProfile.avatarKey`, biznes `Business.logoKey`. Mijoz kesadi (`ImageCropper`, `src/lib/crop.ts`) va 512×512 JPEG yuboradi;
  server baribir `sanitizeDocument` dan o'tkazadi (`src/server/profile-image.ts`). `POST/DELETE /api/talaba/avatar`, `/api/biznes/logo`; ko'rish:
  `/api/avatar/<id>` (faqat o'zi va admin), `/api/biznes/logo/<id>` (tasdiqlangan biznesniki hammaga). Ko'rsatish — `PhotoOr` (rasm yo'q bo'lsa bosh harflar).
- Biznes aloqasi talabaga: `Business.publicPhone|telegram|instagram` (ixtiyoriy, egasi `/biznes/profil/tahrir` da, `validateContacts`); `contactPhone` — mas'ul
  shaxsning kirish raqami, talabaga ko'rsatilmaydi.
- Chegirma foizi 1–100 (bazada CHECK ham); 100% — `FREE_BADGE` ("BEPUL"), narx o'rniga "Bepul" yozuvi.
- Yordam: `/yordam` (talaba, ilova ichida). Aloqa `src/lib/contacts.ts` da (pochta talabapass@gmail.com, Telegram kanal t.me/talabapass, Instagram @talabapass,
  admin t.me/axtamovjonibek); `SUPPORT_TELEGRAM` berilsa admin o'rniga shu. Telefon (`SUPPORT_PHONE`) egasidan kutilmoqda — yo'q bo'lsa qator chiqmaydi. Landing footer: Telegram va Instagram; YouTube/LinkedIn havolasi `#` (manzil berilmagan).
- Universitetlar: `src/server/universities/data.ts` (204 ta, manba InfoEdu.uz 2026-10-16; oliygoh.uz 2023-yilda 209 ta), `syncUniversities` (idempotent, `vercel-build`
  va `npm run universities:sync`; admin tahrirlaganlariga tegmaydi). "Ro'yxatda yo'q" → `UniversityRequest` + talaba `kind=OTHER` yozuviga biriktiriladi;
  admin `/admin/universitetlar` da qo'shadi yoki mavjudiga biriktiradi.
- Admin boshqaruvi (`src/server/admin/manage.ts`, hammasi `AuditLog` da, o'zgargan maydonlar oldin→keyin): `/admin/profil` (o'z ismi, yangi admin —
  SMS + umumiy admin paroli bilan kiradi), `/admin/foydalanuvchilar` (talaba/biznes/kassir: telefon va barcha ma'lumotlar; telefon o'zgarsa sessiyalar yopiladi),
  `/admin/universitetlar`. Adminning o'zi bu yerda tahrirlanmaydi.
- Telefon ko'rinishi testi: `e2e/mobile-layout.spec.ts` (360/390/430, skrinshotlar `e2e/mobile-layout.spec.ts-snapshots`).
