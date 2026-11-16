# Do'konlarga chiqarish — ro'yxat (App Store va Google Play)

Ilova: **TalabaPass**, paket/bundle `uz.talabapass.app`, versiya `mobile/app.json` (`version`). Build va yuborish —
`mobile/README.md` ("EAS"). Bu hujjat — formalarni to'ldirish uchun: qayerga nima yoziladi.

> Javoblar ilovaning hozirgi kodiga qarab tayyorlangan (`src/server/account.ts`, `mobile/app.json`, `docs/api-v1.md`).
> Yangi SDK (analitika, reklama, crash-reporter) qo'shilsa yoki ma'lumot turi o'zgarsa — shu yerni va formalarni yangilang.

## 0. Oldindan tayyor bo'lsin

| Narsa | Qiymat |
|---|---|
| Maxfiylik siyosati | https://talabapass.uz/uz/maxfiylik |
| Foydalanish shartlari | https://talabapass.uz/uz/shartlar |
| Hisobni o'chirish (ilovasiz ham) | https://talabapass.uz/uz/hisobni-ochirish |
| Yordam (Support URL) | https://talabapass.uz/uz#savollar · pochta talabapass@gmail.com |
| Tekshiruvchi hisobi | serverda `REVIEW_PHONE` + `REVIEW_CODE` (pastda, 5-bo'lim) |
| Huquqiy matnlardagi bo'shliqlar | `[STIR]`, `[MANZIL]`, `[N] kun` va h.k. to'ldirilgan bo'lsin (CLAUDE.md "Ishga tushishdan oldin") — Apple/Google maxfiylik siyosatini o'qiydi |
| SMS provayder | ulangan (production'da `OTP_FIXED_CODE` ishlamaydi; tekshiruvchi `REVIEW_*` bilan kiradi) |

## 1. Ilova tavsifi (qoralama)

**Nomi:** TalabaPass · **Apple subtitle (≤ 30):** `Talabalar uchun chegirmalar` · **Toifa:** Lifestyle (asosiy), Shopping (ikkinchi).

**Qisqa tavsif (Play, ≤ 80):**
- uz: `Kafe, kitob, sport va xizmatlarda talabalar uchun chegirma — kassada QR.`
- ru: `Скидки для студентов в кафе, книжных, спортзалах и сервисах — QR на кассе.`

**To'liq tavsif (uz):**

> TalabaPass — O'zbekiston talabalari uchun chegirmalar. Talaba guvohnomangizni bir marta tasdiqlating va shahar
> bo'ylab hamkor kafe, kitob do'koni, sport zali, sartaroshxona va boshqa joylarda maxsus narxdan foydalaning.
>
> • Yaqin atrofdagi chegirmalar xaritada va ro'yxatda, hozir ochiq joylar alohida
> • Kupon oling va kassada QR ko'rsating — QR internetsiz ham ishlaydi
> • Saralangan chegirmalar, xarid tarixi va cheklar
> • Yangi chegirmalar va kupon holati haqida bildirishnomalar
>
> Biznes egalari uchun: chegirma qo'shish, kassada QR skaner, sotuvlar va statistika, kassirlar, oldindan buyurtmalar.

**Полное описание (ru):**

> TalabaPass — скидки для студентов Узбекистана. Один раз подтвердите студенческий билет и пользуйтесь специальными
> ценами в кафе, книжных магазинах, спортзалах, барбершопах и других местах-партнёрах.
>
> • Скидки рядом — на карте и списком, отдельно открытые сейчас
> • Получите купон и покажите QR на кассе — QR работает без интернета
> • Избранное, история покупок и чеки
> • Уведомления о новых скидках и статусе купона
>
> Для бизнеса: добавление скидок, QR-сканер на кассе, продажи и статистика, кассиры, предзаказы.

**Apple keywords (≤ 100, vergul bilan):** `talaba,chegirma,student,skidka,kupon,QR,kafe,Toshkent,talabapass,aksiya`

**Promotional text (Apple, ≤ 170):** `Guvohnomani tasdiqlang — shahar bo'ylab talabalar uchun chegirmalar bir ilovada.`

> Ilovaning o'zi hozir faqat o'zbekcha. Ruscha tavsif qo'shsangiz, App Store'da "Russian" lokalizatsiyasini qo'shing,
> lekin ilova ichi o'zbekcha ekanini tavsifda yozing ("Интерфейс на узбекском языке").

## 2. Skrinshotlar va grafika

| Do'kon | Talab | O'lcham |
|---|---|---|
| App Store | iPhone 6.9" (majburiy, 3–10 ta) | 1320 × 2868 (yoki 1290 × 2796) |
| App Store | iPhone 6.5" (ixtiyoriy — berilmasa 6.9" kichraytiriladi) | 1242 × 2688 |
| App Store | iPad | kerak emas (`supportsTablet: false`) |
| Google Play | Telefon skrinshotlari (2–8 ta) | 9:16, masalan 1080 × 1920 yoki 1080 × 2400 (320–3840 px) |
| Google Play | Feature graphic (majburiy) | 1024 × 500, JPG/PNG, shaffofsiz |
| Google Play | Ikonka | 512 × 512 PNG (`mobile/assets/icon.png` dan kichraytiring) |

Tavsiya etilgan ekranlar: Lenta (chegirmalar), Chegirma tafsiloti, Kupon QR, Yaqin (xarita), Biznes — Skaner, Biznes — Statistika.
Skrinshotda haqiqiy shaxsiy ma'lumot (ism, telefon, guvohnoma) bo'lmasin — sinov hisoblaridan oling.

## 3. App Store — App Privacy (privacy labels)

"Data Used to Track You": **yo'q** (reklama/analitika SDK yo'q, boshqa ilova/saytlar bo'ylab kuzatish yo'q).

| Ma'lumot turi (Apple) | Nima | Bog'langan (Linked) | Maqsad |
|---|---|---|---|
| Contact Info → Phone Number | kirish raqami | ha | App Functionality |
| Contact Info → Name | ism, familiya | ha | App Functionality |
| User Content → Photos or Videos | guvohnoma rasmi, joy/chegirma rasmlari, profil rasmi | ha | App Functionality |
| User Content → Other User Content | biznes hujjatlari (PDF), buyurtma izohi | ha | App Functionality |
| Location → Coarse Location | masofa uchun ~100 m ga yaxlitlangan nuqta (saqlanmaydi, so'rovda keladi) | yo'q | App Functionality |
| Purchases → Purchase History | kupon, sotuv, buyurtma tarixi | ha | App Functionality |
| Identifiers → User ID | hisob ID | ha | App Functionality |
| Identifiers → Device ID | push tokeni (Expo) | ha | App Functionality |
| Usage Data → Product Interaction | chegirma ko'rishlar soni (biznes voronkasi uchun, kunlik yig'indi) | yo'q | Analytics |
| Other Data | universitet, kurs, fakultet, guvohnoma raqami va muddati | ha | App Functionality |

Joylashuv saqlanmasa ham, so'rov server log'iga tushishi mumkin — shuning uchun "Coarse Location" ni ko'rsatish xavfsizroq.
To'lov (oldindan buyurtma) — karta ma'lumoti ilovada/serverda saqlanmaydi (provayder sahifasi), "Financial Info" kerak emas.

## 4. Google Play — Data safety

- Ma'lumot to'planadimi: **ha**. Uzatishda shifrlanadimi: **ha** (HTTPS). O'chirish so'rovi: **ha** — ilovada (Profil → Hisobni
  o'chirish) va URL https://talabapass.uz/uz/hisobni-ochirish.
- Uchinchi tomonga **sharing: yo'q**. (Kassada QR ko'rsatilganda talabaning qisqa ismi va universiteti hamkor kassiriga ko'rinadi —
  bu foydalanuvchi o'zi boshlagan amal, Google qoidasi bo'yicha "sharing" hisoblanmaydi. Ikkilansangiz "Personal info → Name"
  ni "Shared: App functionality" deb belgilang.)

| Toifa → tur | To'planadi | Majburiy | Maqsad |
|---|---|---|---|
| Personal info → Name | ha | ha | App functionality, Account management |
| Personal info → Phone number | ha | ha | App functionality, Account management |
| Personal info → Other info (universitet, kurs, guvohnoma №) | ha | ha (talaba) | App functionality |
| Location → Approximate location | ha (vaqtincha) | yo'q (tuman tanlasa bo'ladi) | App functionality |
| Photos and videos → Photos | ha | ha (talaba guvohnomasi, biznes fotolari) | App functionality |
| Files and docs | ha (biznes guvohnomasi PDF) | biznes uchun | App functionality |
| Financial info → Purchase history | ha | yo'q | App functionality |
| App activity → Other actions (chegirma ko'rishlar) | ha | yo'q | Analytics |
| Device or other IDs | ha (push tokeni) | yo'q | App functionality |

Ruxsatlar (Play "App content" so'rasa): kamera — guvohnoma va joy fotosi, kassada QR skaner; joylashuv — yaqin chegirmalar
(faqat ilova ochiqda, fon joylashuvi yo'q); bildirishnomalar. Mikrofon, media/xotira, fon joylashuvi — **so'ralmaydi**.

## 5. Tekshiruvchi (App Review / Play) uchun kirish

1. Admin panelda sinov **talaba** hisobini oching va **tasdiqlang** (guvohnoma muddati uzoq) — tekshiruvchi chegirmalarni ko'rsin.
   Sinov uchun kamida bitta faol chegirma va biznes bo'lsin.
2. Serverda `/etc/talabapass/env`: `REVIEW_PHONE=+998XXXXXXXXX` (shu hisob raqami), `REVIEW_CODE=XXXXXX` → deploy/qayta ishga tushirish.
   Faqat shu raqamga SMS yuborilmaydi va shu kod ishlaydi; 60 s / kuniga 5 ta / 5 xato chegaralari amal qiladi.
3. Formadagi izoh (Notes):
   > Login: phone +998 XX XXX XX XX → SMS code XXXXXX (no real SMS for this demo number) → set any password (8+ chars,
   > letters and digits) on first login. The demo account is a pre-verified student. Business features (QR scanner,
   > statistics) require a separate verified business account; a screen recording is available at: <video havola>.
   > Account deletion: Profile → "Hisobni o'chirish" (Delete account). The app UI is in Uzbek.
4. Tekshiruv tugagach `REVIEW_*` ni bo'shating (yoki raqamni o'zgartiring).

## 6. Yosh reytingi va auditoriya

- **App Store age rating:** barcha savollarga "None" (zo'ravonlik, kattalar mazmuni, qimor, cheksiz veb yo'q) → **4+**.
  Foydalanuvchilar o'zaro yozishmaydi; biznes mazmuni (chegirmalar) moderatsiyadan o'tadi.
- **Google Play (IARC):** toifa "Reference, News or Educational"/"Utility" emas — **"All Other App Types"**; zo'ravonlik, kattalar
  mazmuni yo'q; "Foydalanuvchilar o'zaro aloqa qiladimi" — yo'q; "Joylashuvni boshqa foydalanuvchilarga ko'rsatadimi" — yo'q;
  raqamli xaridlar — yo'q (oldindan to'lov — jismoniy tovar/xizmat uchun). Kutilgan natija: 3+ / Everyone.
- **Play → Target audience:** **16–17 va 18+** (talabalar). 13 yoshdan kichiklar tanlanmasin — aks holda "Families" siyosati talablari.
- **Apple export compliance:** `ITSAppUsesNonExemptEncryption = false` (faqat HTTPS) — `app.json` da bor.

## 7. Yuborishdan oldin tekshiring

- [ ] `mobile/app.json`: `REPLACE_WITH_EAS_PROJECT_ID` (2 joy) va `REPLACE_WITH_GOOGLE_MAPS_ANDROID_KEY` almashtirilgan.
- [ ] Production build (`eas build --profile production`) haqiqiy telefonda: kirish, kupon QR, skaner, push, hisobni o'chirish.
- [ ] Serverda `APP_MIN_VERSION_*` hozirgi versiyadan baland emas (aks holda ilova o'zini bloklaydi).
- [ ] `APP_STORE_URL_IOS` — App Store ID ma'lum bo'lgach (`https://apps.apple.com/app/id…`).
- [ ] Huquqiy matnlar to'liq; maxfiylik siyosatida push tokeni, joylashuv (yaxlitlangan, saqlanmaydi) va hisobni o'chirish yozilgan.
