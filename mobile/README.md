# TalabaPass — mobil ilova (Expo)

Native ilova: Expo SDK 58, TypeScript, expo-router. Backend — saytdagi `/api/v1` (`../docs/api-v1.md`).
Sayt bilan umumiy kod yo'q: `mobile/` o'z `package.json`, `tsconfig`, ESLint'i bilan; ildizdagi Next build/lint/tsconfig
uni chetlab o'tadi, faqat `mobile/` o'zgargan push saytni deploy qilmaydi. Capacitor qobig'i (`../android`) hozircha qoladi.

- appId / bundle: `uz.talabapass.app`, nomi **TalabaPass**, sxema `talabapass://`.
- Dizayn: kirgandan keyin — saytning telefon ko'rinishi (`src/site/*`); kirishgacha — `../design/app-flow/*.dc.html` (390×844, `src/ui/kit.tsx`).

## Ishga tushirish

Talab: Node 20+ (loyihada 24), telefonda **Expo Go** (SDK 58) yoki dev build.

```bash
cd mobile
npm install
cp .env.example .env        # ixtiyoriy: API manzili (standart — https://talabapass.uz)
npm start                   # QR → Expo Go (telefon va kompyuter bitta tarmoqda)
```

- **Expo Go** Google bilan kirishni ishlatolmaydi (native modul) — u yerda faqat telefon; Google/Apple — dev build (pastda).
- **Sinov kodi:** sinov serverida (`https://talabapass.uz`, `APP_ENV=staging`) SMS o'rniga har doim `000000`.
- **Lokal backend:** ildizda `npm run dev`, `.env` da `EXPO_PUBLIC_API_URL=http://<kompyuter IP>:3000`
  (telefon `localhost` ni ko'rmaydi). `.env` o'zgarsa `npm start -- --clear`.
- Tekshiruv: `npm run typecheck`, `npm run lint` (yoki `npm run check`), `npx expo-doctor`.
- Web (`npm run web`, `react-native-web`) — faqat dizaynni brauzerda solishtirish uchun: saqlash `localStorage`, kamera yo'q,
  sayt API'sida CORS yo'q (brauzer so'rovlarni to'sadi).

## EAS (dev build, APK, do'konlar)

### Birinchi marta (sizning qadamlaringiz)

1. `npx eas-cli@latest login` (expo.dev hisobi).
2. **projectId:** bog'langan — `@jonbekw/talabapass` (`d6b61358-9f51-48c5-a0c2-af2ee25f83b0`, `app.json` `extra.eas.projectId`,
   `updates.url`, `owner`). Boshqa akkauntga ko'chirilsa — shu uch joy yangilanadi.
3. **Google Maps (Android xarita):** Google Cloud → Maps SDK for Android yoqing → API key (cheklov: Android ilovalar,
   paket `uz.talabapass.app` + EAS imzo SHA-1: `npx eas-cli credentials` → Android → Keystore). Kalitni `app.json` dagi
   `REPLACE_WITH_GOOGLE_MAPS_ANDROID_KEY` o'rniga qo'ying. iOS — Apple Maps, kalit shart emas.
4. Build:

```bash
npx eas-cli@latest build --profile development --platform android   # dev client APK (expo-dev-client), kanal development
npx eas-cli@latest build --profile preview --platform android       # sinov APK (ichki tarqatish), kanal preview
npx eas-cli@latest build --profile production --platform all        # do'konlar: Android AAB, iOS store; kanal production
npx eas-cli@latest submit --profile production --platform android   # Play Console (internal track, draft)
npx eas-cli@latest submit --profile production --platform ios       # App Store Connect / TestFlight
```

- Profillar `eas.json` da; hammasida `EXPO_PUBLIC_API_URL=https://talabapass.uz`. Versiya raqamlari EAS serverida
  (`appVersionSource: remote`, production'da `autoIncrement`) — `app.json` dagi `buildNumber`/`versionCode` faqat boshlang'ich qiymat.
- iOS uchun Apple Developer hisobi (yillik to'lov), Android uchun Google Play Console; imzo kalitlarini EAS saqlaydi.
- Do'kon formalari, skrinshotlar, tavsif — `../docs/store-checklist.md`.

## Yangilanishlar: OTA va do'kon relizi

- **OTA** (`expo-updates`, `npx eas-cli update --channel production -m "…"`): faqat JS/rasm/matn o'zgarsa — ekran, matn,
  xato tuzatish, API'dan yangi maydonni ko'rsatish. Ilova fonda yuklab oladi, **keyingi ochilishda** qo'llaydi (ishlayotgan
  ekran to'xtamaydi). Avval `--channel preview` da sinang. Kanal = build profili (development / preview / production).
- **Do'kon relizi** (yangi build): native o'zgarish — yangi paket (`npx expo install …` native modul), `app.json` plugin/ruxsat/
  ikonka/splash, Expo SDK yangilash. `runtimeVersion` = ilova versiyasi (`policy: appVersion`): native o'zgarishda `app.json`
  `version` ni oshiring (1.0.0 → 1.1.0) — eski build'larga yangi OTA bormaydi (mos kelmaydigan JS tushmaydi).
- **Majburiy yangilash:** serverda `APP_MIN_VERSION_IOS` / `APP_MIN_VERSION_ANDROID` (`GET /api/v1/app-config`). Undan past
  versiya — butun ekranli "Ilovani yangilang" (ortga yo'li yo'q), do'konga havola `APP_STORE_URL_*`. Yangi versiya do'konda
  **tasdiqlangandan keyin** oshiring; oxirgi javob qurilmada saqlanadi (internetsiz ochilganda ham amal qiladi).

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
src/copy.ts              joriy til matnlari (`copy`), til ro'yxati; matnlar src/i18n/{uz,ru,en}.ts (uz — saytdagi messages/uz.json nusxasi)
src/lang.tsx             tilni o'qish/saqlash; app/lang.tsx — Til ekrani
src/auth/use-social.ts   Google/Apple bilan kirish (token → /auth/google|apple); app/auth/index.tsx — kirish usuli
assets/fonts/            Archivo statik nusxalari + Golos Text kirill glifllari (OFL, ikkalasi)
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
- **Kirill:** Archivo'da kirill yo'q, RN esa CSS kabi glif bo'yicha boshqa shriftga o'tmaydi — har bir Archivo nusxasiga Golos Text'ning
  shu og'irlikdagi kirill glifllari qo'shilgan (`python mobile/scripts/fonts-cyrillic.py <GolosText[wght].ttf>`; kirill bor faylni o'tkazib
  yuboradi). Lotin/raqam — Archivo, kirill — Golos (62/112 nusxalarda ham oddiy kenglik, kerningsiz). Yangi Archivo nusxasi qo'shilsa — skriptni qayta ishlating.
- **Shrift:** React Native `font-variation-settings` ni bilmaydi — Archivo variable shriftidan kerakli og'irlik/kenglik
  juftlari statik TTF qilib chiqarilgan (wdth 100: 400–900, 112: 800/900, 62: 900). Yangi juftlik kerak bo'lsa —
  fontTools `instancer` bilan (`Archivo[wdth,wght].ttf`, google/fonts), oilaga alohida nom bering va `theme.ts` ga qo'shing.
- **O'lchamlar:** dizayn px = dp. Dizayn `content-box`: 2px chegarali 58px maydon — jami 62 (`kit.tsx` `BOX`).
  Ramkadagi 56px status bar joyi: tepada `max(safe-top + 12, 56)`, pastda `max(safe-bottom + 16, 36)`.
- **Ikonka va splash:** `node scripts/brand-assets.mjs` (ildizdan; manba `design/brand/`; `mobile/scripts/icons.mjs` eskirgan). Ikonka 1024,
  Android adaptive old va monoxrom qatlam — belgi 66dp xavfsiz zonaga sig'diriladi (launcher niqobi chetini kesmasin), bildirishnoma (oq).
  Splash: ko'k `#2432D6` fonda oq logotip — **kvadrat** `splash-icon.png` (1152², `imageWidth: 192`). Android 12+ splash ikonkasini
  288dp maydonda chizib, faqat markazdagi 192dp doirani ko'rsatadi: keng logotip to'g'ridan-to'g'ri berilsa chetlari kesiladi ("alaba Pas").
  Splash Archivo yuklanguncha turadi (`app/_layout.tsx`). Splash'ni faqat release/preview build to'liq ko'rsatadi (Expo Go/dev — yo'q).
- **Ruxsatlar** (`app.json`): kamera (guvohnoma, joy fotosi, QR), joylashuv (faqat ilova ochiqda), bildirishnoma, tebranish; mikrofon,
  fon joylashuvi, media/xotira, fon audio — `blockedPermissions` / plugin sozlamasi bilan o'chirilgan. Matnlar o'zbekcha. Dark mode yo'q (`light`).
- **Klaviatura:** `react-native-keyboard-controller` (ildizda `KeyboardProvider`, Reanimated kerak). `Screen` — `KeyboardAwareScrollView`
  (`KEYBOARD_GAP` 96: fokusdagi maydon va ostidagi asosiy tugma klaviatura ustida); pastdan oynalar (`Sheet`) va OTM tanlovi —
  kutubxonaning `KeyboardAvoidingView` (Modal ichida ham ishlaydi). `Field`/`PasswordBox` da `returnKeyType="next"` — "Keyingi"
  keyingi maydonga o'tkazadi (`KeyboardController.setFocusTo("next")`), oxirgisida `done` + yuborish. Yangi forma — shu qoidalar bilan.
- **Rasmiy belgilar** (`assets/brands/`, manbalari `SOURCE.md`): Yandex Xaritalar, Google Maps, Yandex Go, Telegram, Instagram, Apple
  logo-tugma — asl fayllar, o'zgartirilmagan, faqat kichraytiriladi (`src/ui/brands.ts`, Android'da `resizeMethod="resize"`).
- Matn qo'shilsa — `src/i18n/uz.ts`, `ru.ts`, `en.ts` uchalasiga (kalitlar `Copy` tipi bilan tekshiriladi: biri yetishmasa `tsc` xato beradi).
  `copy` ni modul darajasida (`const x = copy.feed` fayl tepasida) olib qo'ymang — til almashsa eskisi qoladi; komponent ichida o'qing. Rang — `src/theme.ts` (dizaynda bor hex). Yangi native modul — `npx expo install`.

## Til

- Birinchi ochilishda (kirmagan, til tanlanmagan) — Til ekrani (Til.dc.html): O'zbekcha / Русский / English, qurilma tili oldindan
  tanlangan; keyin karusel → kirish usuli. Tanlov SecureStore'da (`tp.lang`). Profil (talaba va biznes) → "Til" — o'sha ekran ← bilan;
  tanlangach ilova bosh ekranidan yangi tilda qayta ochiladi.
- Til serverga `Accept-Language` bilan ketadi (server xato matnlari hozircha o'zbekcha). Server ma'lumotlari (kategoriya nomlari,
  holat yorliqlari, biznes matnlari) — kelganidek.

## Google / Apple bilan kirish

- Oqim (Auth.dc.html): karusel → "Google bilan davom etish", "Apple bilan davom etish", "yoki", "Telefon raqam bilan" → AuthTelefon.
  Apple tugmasi **doim** ko'rinadi: iOS — rasmiy `AppleAuthenticationButton` (native), Android — Apple'ning rasmiy logo-tugmasi bilan qora
  tugma, web oqimi (`expo-web-browser` → `/api/v1/auth/apple/start` → Apple → `form_post` → `/api/v1/auth/apple/callback` →
  `talabapass://auth/apple?ticket=…`; `app/+native-intent.tsx` bu havolani router'ga o'tkazmaydi). Sozlanmagan bo'lsa (iOS: `auth.apple`,
  Android: `auth.appleWeb` false) — "Apple orqali kirib bo'lmadi. Google yoki telefon raqam bilan kiring." Google va telefon tugmasi —
  `GET /app-config` `auth` bo'yicha. Google tugmasi — rasmiy rangli "G" belgisi, oq fonda (branding qoidasi).
- **Xatolar:** har bir Google/Apple xatosi log'ga haqiqiy kodi bilan (`[google] kirish xatosi: code=10 …` — `adb logcat | findstr google`);
  dev rejimida (`__DEV__`) ekranda ham "Xato kodi: …". Foydalanuvchiga — tushunarli jumla (`copy.auth.googleFailed|network|appleFailed`).
  Android `code=10` (DEVELOPER_ERROR) — ilova imzosining SHA-1 i Google Cloud'dagi Android OAuth client'da yo'q (pastdagi qadamlar).
- Hisob bor — ichkariga; yangi — SMS va parolsiz ro'yxatga (talaba 1/3 yoki biznes 1/4), ism Google'dan (Apple — birinchi ruxsatdagi ism)
  oldindan to'ldiriladi. Bunday hisobda telefon yo'q (profilda email), parol yo'q: hisobni o'chirish — shu provayder bilan qayta tasdiqlash.
- Client ID'lar (maxfiy emas) `app.json` → `extra.google` (`webClientId` — token `aud` i, `iosClientId`) va plugin `iosUrlScheme`
  (iOS client ID teskari). Client secret ilovaga kerak emas. Server: `GOOGLE_CLIENT_ID_WEB|IOS|ANDROID`, `APPLE_CLIENT_ID` (docs/api-v1.md).
- `@react-native-google-signin/google-signin` Expo Go'da yo'q: tugma bosilganda modul yuklanadi, bo'lmasa "Expo Go'da ishlamaydi" xabari.
  Sinash — dev yoki preview build.

### Android: SHA-1 va Google Cloud (bir marta)

Android'da Google tokeni faqat ilova imzosi (SHA-1) Google Cloud'dagi **Android** OAuth client'da ro'yxatdan o'tgan bo'lsa beriladi
(aks holda `DEVELOPER_ERROR`). Token `aud` i baribir **web** client ID bo'ladi.

1. `cd mobile && npx eas-cli@latest login` (loyiha `@jonbekw/talabapass` ga bog'langan).
2. Imzo kalitini yaratish/ko'rish: `npx eas-cli@latest credentials -p android` → profil `development` (keyin `preview`, `production` ham)
   → "Keystore: Manage everything needed to build your project" → kalit yo'q bo'lsa "Set up a new keystore" → ekranda **SHA1 Fingerprint**.
   EAS profillari bitta keystore'ni ishlatadi (alohida sozlamagan bo'lsangiz) — SHA-1 bitta. Hozirgi (2026-11-17 yaratilgan, standart,
   development/preview/production uchun bitta) keystore:
   SHA-1 `C9:CF:C8:ED:44:6F:ED:65:AD:7B:CB:5A:D5:CB:0F:61:C2:9C:7C:BF`,
   SHA-256 `E0:28:BA:CE:F7:2C:C7:6F:BE:B5:D0:05:9E:25:E1:D2:4F:B3:1F:25:2E:E5:34:07:56:42:B7:59:CB:9A:AE:B3`.
3. Google Cloud Console → shu loyiha (853458934258) → APIs & Services → Credentials → Create credentials → OAuth client ID →
   **Android**: package `uz.talabapass.app`, SHA-1 — 2-qadamdagi. Play Store'ga chiqqanda Play Console → App integrity → "App signing key
   certificate" SHA-1 ni ham shu tarzda (ikkinchi Android client yoki o'sha client'ga) qo'shing.
4. Android client ID ni serverga: `/etc/talabapass/env` → `GOOGLE_CLIENT_ID_ANDROID=…` (va `GOOGLE_CLIENT_ID_WEB`, `GOOGLE_CLIENT_ID_IOS`),
   deploy yoki `pm2 restart`. Ilovaga Android ID kerak emas (`webClientId` yetadi).
5. OAuth consent screen: "External", ilova nomi, support email, maxfiylik havolasi (`https://talabapass.uz/uz/maxfiylik`); test holatida
   bo'lsa — sinovchilar Gmail'ini "Test users" ga qo'shing (yoki "Publish app").

### Build va sinov (sizning buyruqlaringiz)

```bash
cd mobile
npm install
npx eas-cli@latest build --profile development --platform android   # dev client APK → telefonga o'rnating
npx expo start --dev-client                                         # telefon va kompyuter bitta tarmoqda; APK QR orqali ulanadi
npx eas-cli@latest build --profile preview --platform android       # mustaqil sinov APK (Metro'siz)
npx eas-cli@latest build --profile development --platform ios       # iOS: Apple Developer hisobi; Sign in with Apple capability'ni EAS o'zi yoqadi
```

Apple bilan kirish:
- iOS: Apple Developer → Identifiers → App ID `uz.talabapass.app` → "Sign In with Apple" yoqilgan (EAS build `usesAppleSignIn` bilan so'raydi).
- Android (web oqimi): Identifiers → **Services IDs** → yangi (masalan `uz.talabapass.signin`), "Sign In with Apple" → Configure: Primary App ID
  `uz.talabapass.app`, Domains `talabapass.uz`, Return URLs `https://talabapass.uz/api/v1/auth/apple/callback`.
- Serverda `APPLE_CLIENT_ID=uz.talabapass.app,uz.talabapass.signin` (bundle ID va Services ID, vergul bilan) → `pm2 restart`.
  Client secret / .p8 kalit kerak emas (faqat `id_token` tekshiriladi).

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
  API kaliti kerak** — `app.json` da `["react-native-maps", { "androidGoogleMapsApiKey": "…" }]` (hozir `REPLACE_WITH_GOOGLE_MAPS_ANDROID_KEY` — yuqoridagi "Birinchi marta", 3-qadam).
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

## Push, oflayn, xatolar

- **Push** (`src/lib/push.ts`): kirgandan keyin ruxsat va token. Android kanallari `default` va `orders` (buyurtmalar — yuqori
  muhimlik). Ilova ochiqda: banner + ro'yxat, tovushsiz (skaner/buyurtmalar o'z signalini chaladi), ikonka raqami — o'qilmaganlar.
  Bosilgan xabar → `data.url` → ekran (`src/lib/push-route.ts`; ilova yopiq bo'lsa ham — ishga tushgach). Hodisalar ro'yxati —
  `../docs/api-v1.md` "Push qurilmalari". Expo Go Android, web, emulyator, projectId yo'q — push o'chiq, ilova yiqilmaydi.
- **Oflayn:** tepada "Internet yo'q" banneri (expo-network). `useLoad(fn, enabled, cacheKey)` — muvaffaqiyatli javob
  AsyncStorage'da (`tp.cache.*`, chiqishda tozalanadi); tarmoq yo'q bo'lsa oxirgisi "Oxirgi yangilanish: …" belgisi bilan
  (`StaleNote`). Yozuvchi amallar (POST/PATCH/DELETE) oflaynda yuborilmaydi — "Internet yo'q — amal bajarilmadi". Kupon QR — avvalgidek internetsiz.
- **Xatolar:** ildiz layout'dagi `ErrorBoundary` (expo-router) — ekran yiqilsa "Nimadir buzildi" va "Qayta urinish".

## Dizayndan chetlanishlar

- **Kirgandan keyingi ekranlar = saytning telefon (390px) ko'rinishi.** Talaba: lenta (T4), chegirma (T5), kuponlar va QR (T6),
  tarix va chek (T7), profil (T8), shaxsiy ma'lumotlar, guvohnoma, buyurtmalar, yordam, bildirishnomalar. Biznes: statistika (B6),
  chegirmalar va muharrir (B2), skaner va sotuv (B3/B4), buyurtmalar, sozlamalar (oldindan band qilish), kassirlar, profil (B5),
  tahrir, sotuvlar. Qiymatlar saytdagi komponentlardan (`src/components/**`) `src/site/*` primitivlariga ko'chirilgan (sayt tokenlari
  `theme.ts`, Archivo kengliklari `font(weight, width)`); tekshiruv — `node scripts/app-compare.mjs [--only=…] [--scroll=N] [--probe=sel]`
  (sayt ↔ ilova yonma-yon, `.compare/app/*.png`). Profil/biznes ichki sahifalari tab ichida (pastki menyu ko'rinadi, menyuda belgisi
  yo'q, faol band — `TabBar activeAs`).
- Ilovaga xos chetlanishlar (saytda imkoni yo'q yoki do'kon talabi): soat tanlovi "Boshqa vaqt" — g'ildirak (saytda ro'yxat); rasm
  tanlash — tizim kesish oynasi (saytda kesish oynasi); kassir taklifi — telefon raqami bilan (saytda bir martalik havola, havola bloki
  uslubida); B4 chekida "Chop etish" o'rniga PDF; biznes profilida pastda til, bildirishnomalar, huquqiy havolalar, hisobni o'chirish
  va versiya; kupon/skaner kamerasi — expo-camera; ovozli signal — qurilmada saqlanadi.
- Ilova ichidan ochiladigan, saytda yo'q ekranlar (til, karusel, kirish usuli, kirish/ro'yxat, parol, ro'yxat formalari, tekshiruv) —
  `design/app-flow` dan (`src/ui/kit.tsx`, `src/ui/app.tsx`). Lenta/LentaFiltr/Chegirma/ChegirmaYopiq/Yonalish dizaynlari olib
  tashlangan — o'rniga saytdagi ekranlar.
- Metro (web, Windows) fayl o'zgarishini ko'rmasligi mumkin — solishtirishdan oldin `npx expo start --web --clear` bilan qayta ishga tushiring.
- **Android "orqaga":** tablarda `backBehavior="firstRoute"` (istalgan tab → Chegirmalar / biznesda birinchi tab, undan — ilova fonga;
  kassirda birinchi tab — Skaner). Kirish va ro'yxat tugashi `resetTo` (stek tozalanadi). Filtr/kategoriya/qidiruv — holatda (tarixda emas).
  Oyna ochiq bo'lsa — avval oyna yopiladi (Modal `onRequestClose`). Chegirma/kupon/chek — stek ekranlari: orqaga — ochilgan joyiga,
  lenta o'chmaydi (scroll joyi saqlanadi).

- Slide2–4 (talaba karuseli) dizaynda yo'q — saytdagi kabi Main uslubida.
- Auth: Apple tugmasi — dizayndagi qora "A" o'rniga iOS'da rasmiy `AppleAuthenticationButton` (matni iOS tilida), Android'da Apple'ning
  rasmiy logo-tugmasi (`assets/brands/apple-logo-button.png`) bilan qora tugma; Google — doira ichidagi "G"
  o'rniga rasmiy rangli belgi (Apple va Google branding qoidalari). Telefon ekrani (AuthTelefon) — "Biznes egasimisiz?" havolasi Auth'da.
- Til ekrani profildan ochilganda ← va kichik logo (dizaynda faqat birinchi ochilish chizilgan).
- OTM tanlash oynasi, xato bloklari, yuklanish holatlari, rad etilgan tekshiruv, bosh ekran — dizaynda chizilmagan (primitivlardan).
- Guvohnoma ramkasidagi yozuv statik ("Ramkaga to'g'rilab…"), avtomatik aniqlash yo'q; kamera ruxsati yo'q bo'lsa — "Kameraga ruxsat berish".
- Biznes logotipi B6 da tanlanadi, lekin hisob ochilgach (B8 yuborishda) yuklanadi; serverdagi fayllar (qayta kirishda) belgi bilan.
- B9 (tekshiruvda) — kutish ekrani: "Holatni yangilash" va chiqish; biznes bo'limlari faqat tasdiqdan keyin.
- Telefon ekranida ← tarix bo'lmasa karuselga qaytaradi.
