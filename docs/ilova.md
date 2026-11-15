# Mobil ilova (Capacitor)

Ilova — https://talabapass.uz saytini ochadigan qobiq (`uz.talabapass.app`, "TalabaPass"). Sahifalar serverdan keladi,
shuning uchun saytdagi har bir deploy ilovada ham darhol ko'rinadi — APK'ni qayta yig'ish shart emas.
APK faqat qobiq o'zgarganda qayta yig'iladi: `capacitor.config.ts`, `android/`, `capacitor/www/`, Capacitor plaginlari.

## APK'ni yuklab olish

1. GitHub → repo → **Actions** → chapda **android** → **Run workflow** (branch: `main`) → **Run workflow**.
2. 5–10 daqiqa kuting (yashil belgi chiqadi).
3. Run sahifasini oching → pastda **Artifacts** → **talabapass-debug-apk** — zip yuklanadi.
4. Zip ichida `talabapass-debug-<commit>.apk`.

Artifact 14 kun saqlanadi; keyin workflow'ni qayta ishga tushiring.

## Telefonga o'rnatish (Android Studio kerak emas)

1. APK'ni telefonga o'tkazing: Telegram "Saqlangan xabarlar", Google Drive yoki USB kabel.
2. Telefonda faylni oching.
3. "Noma'lum manbalardan o'rnatish" so'ralsa — shu ilova (Telegram/Fayllar/Chrome) uchun ruxsat bering.
4. Play Protect ogohlantirsa — **Batafsil** → **Baribir o'rnatish** (debug APK Play'da emas, bu kutilgan holat).
5. Ilovani oching — splash'dan keyin sayt ochiladi. Kamera va joylashuv birinchi ishlatilganda so'raladi.

**Yangilash.** Yangi APK eskisining ustidan o'rnatilishi uchun imzo bir xil bo'lishi kerak. Repo'da
`ANDROID_DEBUG_KEYSTORE` secret'i bo'lmasa, har yig'ishda imzo yangi — "Ilova o'rnatilmadi" chiqsa, avval eski
TalabaPass'ni o'chiring. Barqaror imzo uchun (bir marta):

```
keytool -genkeypair -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android \
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
base64 -w0 debug.keystore   # natijani Settings → Secrets → Actions → ANDROID_DEBUG_KEYSTORE ga qo'ying
```

Bu faqat sinov uchun. Play Market'ga chiqishda alohida release kaliti va `assembleRelease`/`bundleRelease` kerak bo'ladi.

## Ilovada sinab ko'rish ro'yxati

- Kirish (SMS kod), lenta, chegirma sahifasi, kupon QR, tarix, profil.
- Tepada status bar, pastda tizim navigatsiyasi/uy chizig'i kontentni yopmaydi; pastki menyu chetgacha to'ladi.
- Qora ekranlar (kupon QR, kassir skaneri): status bar belgilari oq, chetlar qora.
- Kassir skaneri — kamera ruxsati va QR o'qish; "Mening joylashuvim" — joylashuv ruxsati.
- Android "orqaga" tugmasi: oldingi sahifa; birinchi sahifada ilova fonga o'tadi (yopilmaydi).
- Internetsiz ochish — "Internet aloqasi yo'q" ekrani, "Qayta urinish".

## Saytdagi ilova rejimi

- Aniqlash: `isNativeApp()` (`src/lib/native.ts`, `Capacitor.isNativePlatform()`), User-Agent oxirida `TalabaPassApp`.
- `NativeApp` (`src/components/pwa/native-app.tsx`): splash'ni yopadi, status bar uslubi (sahifada `data-edge` bo'lsa oq belgilar),
  Android "orqaga", eski service worker'ni o'chiradi. Service worker (`ServiceWorkerRegister`) va Web Push (`PushToggle`) ilovada o'chiq.
  Saytda "ilovani o'rnat" taklifi yo'q — o'chiradigan narsa ham yo'q.
- Xavfsiz hudud (`globals.css`): `viewport-fit=cover`; `--safe-top/right/bottom/left` (Capacitor Android'ning `--safe-area-inset-*`, bo'lmasa `env()`).
  Sahifa body padding'i bilan xavfsiz hudud ichida; `h-dvh`/`min-h-dvh`/`min-h-screen` shunga moslangan (`--app-h`).
  Pastki menyu (`data-bottom-nav`) pastki chetni o'zi to'ldiradi. Qora butun ekranli sahifa ildiziga `data-edge="ink"|"ink-0"` qo'yiladi.
  Kompyuter va oddiy brauzerda hammasi 0 — dizayn o'lchamlari o'zgarmaydi.
- Bosish maydoni: `tap` utilitasi — ko'rinishni o'zgartirmay ≥ 44×44 px. 44 px dan kichik yangi tugma/havolaga qo'shing
  (`tp-paint` — ::before band, unga qo'yilmaydi). Hover holatlari allaqachon faqat `(hover: hover)` da, bosishda `:active`.

## Ilova oqimi (design/app-flow)

- Ilova `https://talabapass.uz/uz/ilova` dan boshlanadi: birinchi ochilishda tanishtiruv karuseli, keyin — kirish (telefon → SMS kod).
  "O'tkazib yuborish" yoki oxirgi slayd bayroqni qurilmada saqlaydi (`@capacitor/preferences`) — keyingi ochilishlarda karusel yo'q.
- "Biznes egasimisiz? Bu yerdan" → biznes karuseli (2 ta) → biznes kirishi.
- Chiqib ketgandan keyin "Qayta xush kelibsiz" (oxirgi raqam oldindan yozilgan).
- Saytda bu ekranlar yo'q: ular faqat `Capacitor.isNativePlatform()` da qo'yiladigan `tp_app` cookie bilan chiqadi.
- Brauzerda sinash: DevTools konsolida `window.CapacitorCustomPlatform = {name: "android", plugins: {}}` sahifa yuklanishidan oldin
  kerak — `e2e/app-flow.spec.ts` dagi `asNativeApp` shuni qiladi.
- Preferences plagini va yangi start manzili uchun APK qayta yig'ilishi kerak. Eski APK ham ishlaydi: landing o'zi `/ilova` ga o'tadi,
  bayroq esa localStorage'da saqlanadi.

## Ma'lum cheklovlar

- Oflayn kupon (service worker keshi) ilovada yo'q — QR uchun internet kerak (sayt brauzerda/PWA'da oflayn ishlaydi).
- Push xabarnomalar ilovada yo'q (Web Push WebView'da ishlamaydi) — keyin `@capacitor/push-notifications` + FCM.
- Fayl yuklab olish (PDF chek, Excel hisobot) WebView'da standart ishlamasligi mumkin — sinovda tekshiring.
- Chegirma muharririda (telefon) foiz "+ / −" tugmalari 26 px balandlikda va ustma-ust — ular 44 px ga kengaytirilmagan
  (maydonlar bir-birini yopib qo'yardi); dizayn o'zgarishi kerak.
- iOS: `ios/` papkasi hali yo'q (Windows'da yig'ilmaydi). Mac CI'da: `npx cap add ios` → `npx cap sync ios` → Xcode.

## Lokal ishlash

```
npx cap sync android     # capacitor.config.ts yoki plaginlar o'zgargandan keyin
node scripts/pwa-icons.mjs   # ikonka/splash (PWA va android/ ichida)
npx cap open android     # Android Studio bo'lsa (ixtiyoriy)
```

Lokal yig'ish uchun JDK 21 va Android SDK kerak; ularsiz — GitHub Actions orqali.
