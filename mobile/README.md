# TalabaPass — mobil ilova (Expo)

Native ilova: Expo SDK 58, TypeScript, expo-router. Backend — saytdagi `/api/v1` (`../docs/api-v1.md`).
Sayt bilan umumiy kod yo'q: `mobile/` o'z `package.json`, `tsconfig`, ESLint'i bilan; ildizdagi Next build/lint/tsconfig
uni chetlab o'tadi, faqat `mobile/` o'zgargan push saytni deploy qilmaydi. Capacitor qobig'i (`../android`) hozircha qoladi.

- appId / bundle: `uz.talabapass.app`, nomi **TalabaPass**, sxema `talabapass://`.
- Dizayn: `../design/app-flow/*.dc.html` (390×844) — ranglar va o'lchamlar `src/theme.ts` va `src/ui/kit.tsx` da.

## Ishga tushirish

Talab: Node 20+ (loyihada 24), telefonda **Expo Go** (SDK 58) yoki dev build.

```bash
cd mobile
npm install
cp .env.example .env        # ixtiyoriy: API manzili (standart — https://talabapass.uz)
npm start                   # QR → Expo Go (telefon va kompyuter bitta tarmoqda)
```

- **Sinov kodi:** sinov serverida (`https://talabapass.uz`, `APP_ENV=staging`) SMS o'rniga har doim `000000`.
- **Lokal backend:** ildizda `npm run dev`, `.env` da `EXPO_PUBLIC_API_URL=http://<kompyuter IP>:3000`
  (telefon `localhost` ni ko'rmaydi). `.env` o'zgarsa `npm start -- --clear`.
- Tekshiruv: `npm run typecheck`, `npm run lint` (yoki `npm run check`), `npx expo-doctor`.
- Web (`npm run web`, `react-native-web`) — faqat dizaynni brauzerda solishtirish uchun: saqlash `localStorage`, kamera yo'q,
  sayt API'sida CORS yo'q (brauzer so'rovlarni to'sadi).

## EAS (dev build, APK, do'konlar)

```bash
npx eas-cli@latest login
npx eas-cli@latest init                                       # projectId app.json ga yoziladi — commit qiling
npx eas-cli@latest build --profile development --platform android   # dev client APK (expo-dev-client)
npx eas-cli@latest build --profile preview --platform android       # sinov APK (ichki tarqatish)
npx eas-cli@latest build --profile production --platform all        # do'konlar uchun (AAB / IPA)
```

- Profillar `eas.json` da; uchalasida `EXPO_PUBLIC_API_URL=https://talabapass.uz`. Production backend tayyor bo'lsa — shu yerda.
- iOS build uchun Apple Developer hisobi (yillik to'lov), Android do'koni uchun Google Play Console hisobi kerak;
  imzo kalitlarini EAS o'zi yaratib saqlaydi (birinchi build'da so'raydi).
- Dev build'dan keyin: `npm start` → ilova o'zi ulanadi (Expo Go shart emas).

## Tuzilma

```
src/app/                 ekranlar (expo-router): index (ishga tushish), intro, biz-intro,
                         auth/{phone,code,login,password,returning}, student/{register,card,review},
                         business/{info,details,docs,review}, cashier/register, home (zaxira)
src/app/(tabs)/          talaba ilovasi (APPROVED): deals, nearby, coupon, saved, profile
src/app/deal/[id]        chegirma tafsiloti; coupon/[id] — kupon (QR); notifications; account/delete
src/app/panel/           biznes ilovasi (egasi va kassir): stats, discounts, scan, sales, profile
src/app/biz/             egasi: discount/[id] (muharrir, "new"), orders, edit, cashiers; receipt/[id] — chek (hammaga)
src/business/            biznes primitivlari (ui.tsx), yangi buyurtma kuzatuvi (orders-watch.tsx)
src/student/             kupon chiptasi (CouponPanel), joy tanlovi, "Qanday boraman?" oynalari
src/lib/                 totp (QR/kod, saytdagi bilan bir xil), feed (filtr/saralash), format (narx/vaqt/holat),
                         offline (AsyncStorage: faol kuponlar, oxirgi me), location (GPS/tuman/viloyat),
                         use-load (yuklanish/xato/refresh), push (Expo push tokeni), directions
src/api/client.ts        fetch, tokenlar, refresh (bir vaqtda faqat bitta), xato formati
src/api/endpoints.ts     /api/v1 chaqiruvlari va tiplari; business.ts — biznes ilovasi
src/state.tsx            sessiya (me), kirish/ro'yxat oqimi, biznes qoralamasi; routeFor — kim qayerga
src/storage.ts           expo-secure-store: tokenlar, karusel ko'rilgani, oxirgi raqam
src/ui/kit.tsx           dizayn primitivlari (Screen, Title, Field, PhoneBox, CodeBoxes, PasswordBox, PrimaryButton…)
src/ui/app.tsx           talaba ilovasi primitivlari (DealCard, StatusPill, PctBadge, Chip, Sheet, Empty/Failed…);
                         tab-bar.tsx — pastki menyu; deals-map(.web).tsx — xarita
src/ui/intro-art.tsx     karusel rasmlari; src/ui/icons.tsx — SVG ikonkalar
src/theme.ts             ranglar (dizayndagi hex), Archivo nusxalari
src/copy.ts              matnlar (saytdagi messages/uz.json nusxasi)
assets/fonts/            Archivo statik nusxalari (OFL)
assets/sounds/           skaner/buyurtma signallari (`node mobile/scripts/sounds.mjs` sintez qiladi)
```

## Qoidalar

- **Tokenlar:** access (15 daq) va refresh (30 kun, aylanadi) — SecureStore'da. Muddati o'tgan access token oldindan,
  401 (`token_expired`/`unauthorized`) bo'lsa keyin yangilanadi; parallel so'rovlar bitta refresh va'dasini kutadi.
  Refresh rad etilsa — tokenlar o'chadi, ilova kirish ekraniga qaytadi. Boshqa 401'lar (`wrong_password`) sessiyaga tegmaydi.
- **Fayl yuklash** (`fileForm`, `src/api/endpoints.ts`): SDK 58 da global `fetch` — `expo/fetch`, u RN uslubidagi
  `{ uri, name, type }` qismini o'qimaydi (so'rov serverga yetmaydi). Qismda `bytes()` (expo-file-system `File`) ham bor.
  Rasmlar oldin siqiladi (`src/lib/image.ts`: uzun tomon 2000px, JPEG 0.8), hajm (10 MB) siqilgandan keyin tekshiriladi.
  Xato turlari `ApiError.kind`: `network` (faqat haqiqiy tarmoq xatosi), `too_large` (413), `session`, `other`;
  har bir xato console'ga `[api] …` bilan chiqadi (Expo Go terminali yoki `adb logcat`).
- **Shrift:** React Native `font-variation-settings` ni bilmaydi — Archivo variable shriftidan kerakli og'irlik/kenglik
  juftlari statik TTF qilib chiqarilgan (wdth 100: 400–900, 112: 800/900, 62: 900). Yangi juftlik kerak bo'lsa —
  fontTools `instancer` bilan (`Archivo[wdth,wght].ttf`, google/fonts), oilaga alohida nom bering va `theme.ts` ga qo'shing.
- **O'lchamlar:** dizayn px = dp. Dizayn `content-box`: 2px chegarali 58px maydon — jami 62 (`kit.tsx` `BOX`).
  Ramkadagi 56px status bar joyi: tepada `max(safe-top + 12, 56)`, pastda `max(safe-bottom + 16, 36)`.
- **Ikonka:** `node mobile/scripts/icons.mjs` (ildizdan; saytdagi PWA ikonkasi bilan bir xil "ticket").
- Matn qo'shilsa — `src/copy.ts`; rang — `src/theme.ts` (dizaynda bor hex). Yangi native modul — `npx expo install`.

## Talaba ilovasi (kirgandan keyin)

- Faqat `APPROVED` talaba: `(tabs)/_layout` boshqa holatni `routeFor` ga yuboradi (DRAFT/EXPIRED — guvohnoma, PENDING/REJECTED —
  tekshiruv). API 403 `student_not_approved` qaytarsa (`useLoad`) — `me` yangilanib, o'sha ekranga.
- Lenta: server bir marta hammasini beradi, qidiruv/kategoriya/"Hozir ochiq"/saralash qurilmada (`src/lib/feed.ts` — saytdagi kod).
  Joy: GPS (~100 m), Toshkent tumani yoki viloyat (`GET /districts`), `tp.joy` da saqlanadi; "Yaqin" GPS'ni tanlovga yozmaydi.
- **Kupon internetsiz:** olingan kupon (secret bilan) AsyncStorage'da (`tp.coupons`); QR va 6 raqamli kod `src/lib/totp.ts` da
  (@noble/hashes — Hermes'da `crypto.subtle` yo'q), saytdagi bilan tengligi tekshirilgan. Ilova internetsiz ochilsa — oxirgi `me`
  bilan, faol kupon bo'lsa "Kupon" tabiga. Internet bo'lsa kupon ekrani 4 s da holatni so'raydi (sotildi → tebranish, yopildi).
  Muddati o'tgani o'qishda tashlanadi; chiqish/hisobni o'chirishda nusxalar tozalanadi. Kupon ekrani yoqiq turadi (expo-keep-awake).
- **Xarita:** react-native-maps (iOS — Apple Maps, Android — Google Maps). Expo Go'da kalitsiz ishlaydi; **Android build uchun Google Maps
  API kaliti kerak** — `app.json` da `["react-native-maps", { "androidGoogleMapsApiKey": "…" }]` (hozir yo'q, xarita bo'sh chiqadi).
- **Push:** tablarga kirganda ruxsat so'raladi, Expo push tokeni `POST /push/devices` ga. Expo Go (Android), emulyator, web yoki EAS
  `projectId` yo'q bo'lsa — jimgina o'tkazib yuboriladi (`[push]` log). Server Expo Push API orqali yuboradi (docs/api-v1.md).
- Hisobni o'chirish: Profil → "Hisobni o'chirish" (parol, `DELETE /me`); Maxfiylik siyosati va Shartlar — saytdagi huquqiy sahifalar.

## Biznes ilovasi (egasi va kassir)

- Kirish o'sha oqim ("Biznes"): `routeFor` — tasdiqlangan egasi `/panel/stats`, kassir `/panel/scan`; ariza to'ldirilmagan/rad
  etilgan — B6–B8 (sababi bilan), tekshiruvda — B9 kutish ekrani. Tablar `src/app/panel/_layout.tsx`: kassirga Statistika va
  Chegirmalar yopiq (`href: null`; server ham 403). Qoidalar saytdagi bilan bitta — API (`docs/api-v1.md` "Biznes ilovasi").
- **Kassir qo'shish** — telefon raqami bilan (Profil → Kassirlar). Kassir ilovaga shu raqam bilan "Biznes" orqali kiradi: kod →
  parol → ism (`/cashier/register`). Faolsizlantirilsa — kassirning sessiyasi darhol yopiladi (ilova kirishga qaytadi).
- **Skaner:** expo-camera (`barcodeScannerEnabled: true` — build uchun), faqat QR; bir xil QR 4 s ichida qayta yuborilmaydi.
  Qo'lda — kupon kodi + 6 raqam. Natija: tovush (expo-audio, telefon ovozsiz bo'lsa — faqat tebranish) + tebranish.
  Tab ko'rinmasa kamera o'chadi. Narxsiz chegirmada kassir summani kiritadi (1+1 — bitta mahsulot narxi).
- **Chegirma muharriri** (`biz/discount/[id]`): tekshiruv `src/lib/discount.ts` (saytdagi `validateDiscount` nusxasi — saytda
  o'zgarsa, shu yerda ham); sana `kk.oo.yyyy`, vaqt `12:00`. Yangi rasmlar saqlangandan keyin yuklanadi (sayt kabi).
- **Buyurtmalar** (oldindan buyurtma yoqilgan bo'lsa ko'rinadi; sozlash — saytda): qabul/rad (sabab)/tayyor, javob muddati
  taymeri. Yangi buyurtma: ilova ochiq — 15 s da so'rov va `order` signali (`business/orders-watch.tsx`); yopiq — push
  (server Expo Push API orqali yuboradi), bosilsa buyurtmalar ekrani.
- **Rasmlar:** API imzoli havolalar beradi (`/api/v1/files/…`, 1–2 soat) — `<Image source={{ uri: imageUrl(url) }}>`, sarlavhasiz.
  Eskirsa — ekranni yangilash yangi havola beradi. Chek PDF — shu havola brauzerda.
- Hisobni o'chirish — faqat egasi (kassirni egasi faolsizlantiradi).

## Dizayndan chetlanishlar

- Biznes ilovasi ekranlari (panel, skaner, muharrir, buyurtmalar, kassirlar, chek) app-flow'da chizilmagan — mazmun saytdagi
  B2–B6 dan, ko'rinish talaba ilovasi primitivlari uslubida, to'q sariq urg'u (saytdagi biznes mavzusi), skaner — qora fon.
  Saytdagidan farqi: issiqlik xaritasi o'rniga xulosa (eng gavjum vaqt, eng bo'sh kun), Excel hisobot va oldindan buyurtma
  sozlamalari — saytda, kassir taklifi havola o'rniga telefon raqami bilan.


- Talaba ilovasi ekranlari (lenta, tafsilot, xarita, kupon, saralangan, bildirishnomalar, profil) app-flow'da chizilmagan — mazmun
  saytdagi T4–T8 dan, ko'rinish app-flow primitivlari uslubida. Saytdagidan farqi: "Tez tugaydi" qatori, metro va profil tahriri yo'q;
  kupon tarixi ro'yxati — saytda (bitta chek — kupon sotilgach "Chekni ko'rish").

- Slide2–4 (talaba karuseli) dizaynda yo'q — saytdagi kabi Main uslubida.
- OTM tanlash oynasi, xato bloklari, yuklanish holatlari, rad etilgan tekshiruv, bosh ekran — dizaynda chizilmagan (primitivlardan).
- Guvohnoma ramkasidagi yozuv statik ("Ramkaga to'g'rilab…"), avtomatik aniqlash yo'q; kamera ruxsati yo'q bo'lsa — "Kameraga ruxsat berish".
- Biznes logotipi B6 da tanlanadi, lekin hisob ochilgach (B8 yuborishda) yuklanadi; serverdagi fayllar (qayta kirishda) belgi bilan.
- B9 (tekshiruvda) — kutish ekrani: "Holatni yangilash" va chiqish; biznes bo'limlari faqat tasdiqdan keyin.
- Telefon ekranida ← tarix bo'lmasa karuselga qaytaradi.
