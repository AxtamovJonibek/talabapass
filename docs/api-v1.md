# Mobil ilova API — `/api/v1`

Native ilova (Expo / React Native) uchun JSON API. Sayt va server action'lar o'zgarmagan: API o'sha `src/server/*`
mantig'ini chaqiradi (OTP chegaralari, parol qoidasi va qulfi, kupon, ro'yxat, fayl tozalash).

Kod: marshrutlar `src/app/api/v1/**/route.ts`, umumiy qism `src/server/api/` (`http.ts` — xato formati va o'qish,
`session.ts` — tokenlar va rol tekshiruvi, `auth-flow.ts`, `rate-limit.ts`, `rules.ts` — sof funksiyalar).

## Umumiy

- Manzil: `https://talabapass.uz/api/v1/...`. Tana — JSON (`content-type: application/json`), fayl — `multipart/form-data`.
- Himoyalangan endpoint: `Authorization: Bearer <accessToken>`.
- Javoblar `cache-control: no-store`.
- Xato har doim bir xil:
  ```json
  { "error": { "code": "wrong_password", "message": "Parol noto'g'ri.", "left": 4 } }
  ```
  `message` — foydalanuvchiga ko'rsatsa bo'ladigan o'zbekcha matn (`messages/uz.json` → `api.errors`). Qo'shimcha maydonlar:
  `fields` (zod xatosidagi maydonlar), `retryInSeconds` (+ `Retry-After` sarlavhasi), `left` (qolgan urinish), `status` (talaba holati).
- Asosiy kodlar: `invalid_request` 400, `unauthorized` 401, `token_expired` 401 (refresh qiling), `forbidden` 403
  (begona rol), `not_found` 404, `rate_limited` 429, `payload_too_large` 413, `server_error` 500. To'liq ro'yxat —
  `src/server/api/http.ts` (`STATUS`).
- So'rov chegaralari (IP yoki foydalanuvchi bo'yicha, `RateLimitHit`): kod tekshirish 30/15 daq, parol bilan kirish
  30/15 daq, parol o'rnatish 20/15 daq, refresh 120/soat, ro'yxat 10/soat, fayl yuklash 30/soat, kupon olish 30/10 daq,
  boshqa yozuvlar 120/10 daq. SMS — saytdagi qoidalar (raqamga 60 s da 1 ta va kuniga 5 ta, IP'dan soatiga 10 ta).
- Fayl manzillari (`images`, `image`, `logoUrl`, `url`, `pdfUrl`) — **imzoli nisbiy havolalar** (`/api/v1/files/<tur>/<id>?exp=&sig=`),
  sayt manziliga qo'shib, sarlavhasiz oching (pastdagi "Fayllar").

## Tokenlar

| | Muddat | Qayerda |
|---|---|---|
| `accessToken` | 15 daqiqa | Faqat xotirada. Muhrlangan (AES-GCM), har so'rovda sessiya qatori tekshiriladi — chiqish/bloklash darhol kuchga kiradi |
| `refreshToken` | 30 kun (har yangilashda suriladi) | Xavfsiz xotirada (SecureStore/Keychain). Bazada faqat xeshi (`Session`, `kind = API`, qurilma nomi bilan) |

Refresh token **aylanadi**: `/auth/refresh` yangi juft beradi, eskisi yaroqsiz. Eski token qayta kelsa — nusxasi
o'g'irlangan deb sessiya yopiladi (`refresh_reused`), foydalanuvchi qaytadan kiradi. Shuning uchun mijoz bir vaqtda
faqat bitta refresh so'rovi yuborsin va yangi juftni darhol saqlasin.

Kirish javobi (`SignedIn`):
```json
{
  "tokens": { "tokenType": "Bearer", "accessToken": "…", "accessTokenExpiresAt": "2026-11-15T12:15:00.000Z",
              "refreshToken": "…", "refreshTokenExpiresAt": "2026-12-15T12:00:00.000Z" },
  "user": { "…": "GET /me dagi bilan bir xil" }
}
```

## Auth

Oqim: telefon → SMS kod → (hisob bor va parol bor) parol bilan kirish | (yangi raqam yoki parolsiz hisob) parol
o'rnatish → (yangi raqam) ro'yxat. Raqam ro'yxatda bor-yo'qligi kod to'g'ri kiritilmaguncha bilinmaydi. Qadamlar
orasidagi holat — muhrlangan `ticket` (10 daqiqa; parol o'zgarsa yaroqsiz) va `registrationTicket` (30 daqiqa).
Admin API orqali kirmaydi (`admin_not_supported`).

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `POST /auth/code` | `{ phone }` | `{ phone, resendInSeconds }` · xato: `invalid_phone`, `too_soon`, `daily_limit`, `ip_limit`, `code_locked`, `sms_failed` |
| `POST /auth/verify` | `{ phone, code, intent: "student"\|"business" }` | `{ next: "password", ticket, role, masked, initial }` yoki `{ next: "setPassword", ticket, role, isNew, businessName? }` · xato: `wrong_code`, `code_expired`, `code_locked`, `account_blocked`, `no_business`, `admin_not_supported` |
| `POST /auth/login` | `{ ticket, password, deviceName? }` | `SignedIn` · xato: `wrong_password` (+`left`), `password_locked` (+`retryInSeconds`; 5 xato → 15 daq), `step_expired` |
| `POST /auth/password` | `{ ticket, password, confirm, deviceName? }` | yangi raqam: `{ next: "register", role, registrationTicket }` (`role`: `student` \| `business` \| `cashier`); aks holda `{ next: "signedIn", tokens, user }` · xato: `weak_password` (≥ 8, harf + raqam), `password_mismatch`, `step_expired` |
| `POST /auth/refresh` | `{ refreshToken }` | `{ tokens }` · xato: `refresh_invalid`, `refresh_reused` |
| `POST /auth/logout` | Bearer (muddati o'tgani ham) | `{ ok: true }` — sessiya va unga bog'langan push qurilmasi o'chadi |

"Parolni unutdim": `verify` → `next: "password"` bo'lgan `ticket` bilan `POST /auth/password` — yangi parol, boshqa
barcha sessiyalar (sayt ham) yopiladi.

## Ilova sozlamasi

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `GET /app-config` | — (kirishsiz) | `{ minVersion: { ios, android }, latestVersion, storeUrls: { ios, android } }` |

Qiymatlar env'dan: `APP_MIN_VERSION_IOS`, `APP_MIN_VERSION_ANDROID`, `APP_LATEST_VERSION`, `APP_STORE_URL_IOS`, `APP_STORE_URL_ANDROID`
(berilmasa — 1.0.0 va Play havolasi; noto'g'ri qiymat — deploy `check-env` da to'xtaydi). Ilova versiyasi `minVersion` dan past —
butun ekranli majburiy yangilash.

## Profil

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `GET /me` | Bearer | `{ user: { id, phone, role, firstName, lastName, hasPassword, student: { status, publicId, course, faculty, districtId, cardExpiresAt, university } \| null, business: { id, name, status, submitted, rejectReason, memberRole } \| null } }` |
| `DELETE /me` | Bearer, `{ password }` | `{ ok: true }` · xato: `wrong_password`, `password_locked`, `open_orders` |

Hisobni o'chirish: qator qoladi (sotuv/kupon tarixi biznes hisobotlari uchun), shaxsiy ma'lumot tozalanadi, raqam
bo'shaydi (`deleted:<id>`; shu raqam bilan keyin yangi hisob ochsa bo'ladi), holat `DELETED`, barcha sessiyalar yopiladi.
Talabaning guvohnoma fayllari va profil rasmi o'chiriladi, faol kuponlar bekor. Biznes egasida chegirmalar talabaga
ko'rinmay qoladi, kassirlar chiqariladi. Pul hal bo'lmagan buyurtma bo'lsa — `open_orders` (`src/server/account.ts`).

## Talaba ro'yxati

Oqim: `/auth/verify` (intent `student`, yangi raqam) → `/auth/password` → `registrationTicket` → `POST /student/register`
→ `POST /student/card` → admin tekshiradi → `GET /student/status` (yoki `GET /me`) `APPROVED`.

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `GET /universities?q=` | — (kirishsiz) | `{ universities: [{ id, name, shortName, region, kind }], otherId: "other" }` |
| `GET /districts` | — (kirishsiz) | `{ districts: [{ id, name, lat, lng }], regions: [{ id, name, lat, lng }] }` — joy tanlovi (Toshkent tumanlari va viloyatlar, saytdagi `location-select` guruhlari); tanlangani `districtId` / `regionId` |
| `POST /student/register` | `{ registrationTicket, firstName, lastName, universityId, universityOther?, course: "C1"\|"C2"\|"C3"\|"C4"\|"MASTER", deviceName? }` | 201 `SignedIn` (talaba `DRAFT`) · xato: `invalid_request` + `fields`, `step_expired` |
| `POST /student/card` | Bearer (talaba, tasdiqlanmagan ham), multipart `file` (JPG/PNG/HEIC/PDF ≤ 10 MB) | 201 `{ verificationId, status: "PENDING" }` · xato: `file_bad_type`, `file_too_large`, `file_empty`, `upload_not_allowed` (tasdiqlangan), `upload_daily_limit` |
| `GET /student/status` | Bearer (talaba) | `{ status, cardExpiresAt, verification: { id, status, fileName, rejectReason, createdAt, queuePosition } \| null }` |

`universityId = "other"` bo'lsa `universityOther` — OTM nomi (3–120 belgi); admin keyin ro'yxatga qo'shadi.
Talaba holatlari: `DRAFT` (guvohnoma yuklash), `PENDING`, `APPROVED`, `REJECTED` (`rejectReason` bilan, qayta yuklaydi),
`EXPIRED` (guvohnoma muddati o'tgan — yangisini yuklaydi), `BLOCKED`.

## Biznes ro'yxati (4 qadam)

1. **Info** — `POST /business/validate` `{ step: "info", name, kind, address }` → `{ ok, fields: [] }` (saqlamaydi).
2. **Tafsilot** — `POST /business/validate` `{ step: "details", workingHours, tin, description?, contactName }`, so'ng
   `POST /business/register` `{ registrationTicket, name, kind, address, workingHours, description?, tin, contactName, deviceName? }`
   → 201 `SignedIn` (egasi hisobi va ariza ochiladi) · xato: `invalid_request` + `fields`, `tin_taken`, `step_expired`.
3. **Fayllar** — `POST /business/documents?kind=registration|photo|logo` (Bearer, multipart `file`) → 201 `{ id, kind }`.
   Guvohnoma bitta (yangisi almashtiradi, PDF ham), joy fotolari 1–3 ta (`too_many_files`), logotip/foto — faqat rasm.
   O'chirish: `DELETE /business/documents/<id>`.
4. **Yuborish** — `POST /business/submit` `{ consent: true }` → `{ ok, status: "PENDING" }` · xato: `no_registration`,
   `no_photos`, `consent_required`, `not_editable`.

`kind`: `CAFE`, `SHOP`, `SERVICE`, `SPORT`, `BEAUTY`, `EDUCATION`, `ENTERTAINMENT`. STIR — 9 raqam (bo'sh joy bilan ham).

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `GET /business/application` | Bearer (biznes egasi) | `{ application: { id, name, kind, address, workingHours, description, tin, contactName, status, submittedAt, rejectReason, editable, hasLogo, documents: [{ id, kind, fileName }] } }` |
| `PATCH /business/application` | Bearer, 2-qadamdagi barcha maydonlar | `{ application }` · faqat yuborilmagan yoki rad etilgan arizada (`not_editable`) |

Holat: `PENDING` + `submittedAt: null` — to'ldirilmoqda; `PENDING` + sana — tekshiruvda; `APPROVED`/`WARNED` — faol;
`REJECTED` — `rejectReason`, tuzatib qayta yuboriladi; `BLOCKED`.

## Talaba: chegirmalar, kupon, bildirishnomalar

Hammasi Bearer, faqat **tasdiqlangan** talaba (aks holda 403 `student_not_approved` + `status`). Joy (masofa uchun)
so'rov parametrida: `lat`+`lng` (GPS, ~100 m ga yaxlitlanadi) **yoki** `districtId` (tuman) **yoki** `regionId` (viloyat).

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `GET /deals` | joy?, `q`, `category` (slug, standart `all`), `live=1`, `sort=near\|biggest\|ending\|new` | `{ deals: FeedDeal[], categories: [{ slug, name, icon, tileColor, inkColor }], now }` |
| `GET /deals/nearby` | joy (majburiy), `radiusKm` (0.1–50, standart 5), `limit` (≤ 200) | `{ origin, deals: FeedDeal[] }` — yaqini oldin |
| `GET /deals/<id>` | joy? | `{ deal, description, terms, weekdays, fromMinute, toMinute, perStudentLimit, endsOn, business, nearby, saved, coupon: CouponView \| null }` |
| `GET /saved` | joy? | `{ deals: FeedDeal[] }` |
| `PUT /saved/<id>` · `DELETE /saved/<id>` | — | `{ saved }` (idempotent) |
| `POST /coupons` | `{ discountId }` | 201 `{ coupon: CouponView, existing: false }` (faol kupon bo'lsa 200 + `existing: true`) · xato: `deal_not_available`, `deal_closed`, `sold_out`, `coupon_limit` |
| `GET /coupons` | — | `{ coupons: CouponView[] }` (faollari) |
| `GET /coupons/<id>` | — | `{ status: "ACTIVE", coupon }` \| `{ status: "REDEEMED", redemptionId }` \| `{ status: "CLOSED" }` |
| `DELETE /coupons/<id>` | — | `{ ok }` — bekor, kunlik qoldiq qaytadi |

`FeedDeal` (`src/lib/feed.ts`): `id, title, businessId, store, typeLabel, district, address, landmark, category, icon,
images, tile, ink, badge, price: { now, old } | null, note, percent, fromMinute, toMinute, live, closesAt, opensAt,
lastDay, left, total, point: { lat, lng } | null, distanceKm, createdAt`. Vaqtlar ISO (UTC), daqiqalar Toshkent vaqtida.

`CouponView`: `id, discountId, code, secret, expiresAt, title, store, badge, price, note, student`. **QR internetsiz** qurilmada
hisoblanadi — saytdagi `src/lib/totp.ts` bilan aynan bir xil: 60 s oyna, QR = `kod.oyna.HMAC-SHA256(secret, oyna)` ning
128 biti, ekranda yana 6 raqamli kod. `secret` — base64url, faqat kupon egasiga; kupon 10 daqiqa amal qiladi. Kassir
tasdiqlaganini bilish uchun ekran ochiq paytda `GET /coupons/<id>` ni bir necha soniyada so'rang.

Bildirishnomalar (talaba va biznes egasi):

| Endpoint | Chiqish |
|---|---|
| `GET /notifications` | `{ unread, items: [{ id, title, body, at, unread, link: { type: "HOME"\|"CATEGORY"\|"DISCOUNT", id }, href }] }` |
| `POST /notifications/read` | tana bo'sh — hammasi, `{ ids: string[] }` (1–100) — faqat shular (begona id e'tiborsiz) → `{ marked }` |

## Biznes ilovasi (egasi va kassir)

Rollar saytdagidek: **egasi** (`BUSINESS_OWNER`) — faqat tasdiqlangan (`APPROVED`/`WARNED`, yuborilgan) biznesda; aks holda
403 `business_not_ready` (ariza holati — `GET /me` va `GET /business/application`). **Kassir** (`CASHIER`) — faqat skaner,
o'z sotuvlari va cheklari; boshqa biznes endpoint'lari 403 `forbidden`. Biznes hech qachon so'rovdan olinmaydi — sessiyadan
(kassir — faol a'zoligi, egasi — o'z biznesi). Kod: `src/server/api/business.ts`, testlar `src/server/api/business.itest.ts`.

### Skaner va sotuv (egasi va kassir)

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `POST /business/scan` | `{ qr }` yoki `{ code, totp }` (kupon kodi **va** 6 raqam) | kupon: `{ kind: "coupon", preview }`; `TB-` buyurtma: `{ kind: "order", order }` |
| `POST /business/scan/confirm` | `{ couponId, ticket, paymentType: "CASH"\|"CARD"\|"QR", amount? }` | 201 `{ receipt, pdfUrl }` |
| `POST /business/orders/<id>` | `{ action: "complete", ticket }` ("Berildi") | `{ ok }` |
| `GET /business/sales` | `period=1\|7\|30` (standart 1), `page`, `cashier?` (faqat egasi) | `{ rows, count, sum, page, pages, staff }` — kassirga faqat o'zi tasdiqlaganlari, `staff: null` |
| `GET /receipts/<id>` | talaba (o'ziniki), egasi, kassir (faqat o'zi tasdiqlagan) | `{ receipt, pdfUrl }` |

- `preview` (`ScanPreview`, `src/server/coupons/scan.ts`): `couponId, code, ticket, student { name, initials, university, course }, title, badge,
  originalPrice, discountAmount, finalPrice, percent, bogo, limit, nth`. `finalPrice: null` — narxsiz chegirma: kassir `amount` kiritadi
  (foizli — chek summasi, 1+1 — bitta mahsulot narxi). `ticket` 5 daqiqa amal qiladi va **skanerlagan xodimga** bog'langan.
- `order` (`OrderScanPreview`): `orderId, code, ticket, title, quantity, kind, slot, validUntil, student { name, initials, phone }, note,
  prepayAmount, totalFinal, dueNow` (kassada olinadigan qoldiq).
- Skan xatolari (har urinish `ScanAttempt` ga): `scan_invalid` (+ `attemptsLeft` qo'lda kiritishda), `scan_expired`, `scan_replayed`,
  `scan_wrong_business`, `scan_blocked`, `scan_manual_locked` (kuponga 5 xato), `scan_ticket` (qayta skanerlang), `order_not_confirmed`,
  `order_closed`; har birida `result` (`INVALID`, `EXPIRED`, … — ilova natija ekrani uchun). Tasdiqlash atom: ikki kassir bir vaqtda
  bossa ikkinchisi `scan_replayed`. Chegara: 300 so'rov / 10 daq.
- `receipt` (`ReceiptData`): `id, no, business { name, address, tin }, time, createdAt, student, cashier, item, badge, originalPrice,
  discountAmount, paidAmount, paymentType, category`.

### Egasi

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `GET /business/stats` | `period=1\|7\|30` (standart 7) | `{ business, period, kpi { sold, delta, revenue, average, discount, fresh, returningPercent }, chart { hourly, bars: [{ key, count, current }] }, funnel { views, qr, sold }, heat { busiest, quietest }, universities, offers, offerTotals, sales, cashiers }` |
| `GET /business/discounts` | — | `{ discounts: [{ id, title, type, originalPrice, percent, newPrice, weekdays, fromMinute, toMinute, dailyLimit, endsOn, status, rejectReason, soldToday, image }] }` |
| `POST /business/discounts` | `{ draft, intent: "draft"\|"publish" }` | 201 `{ id, status }` (`publish` → `PENDING_REVIEW`) |
| `GET /business/discounts/<id>` | — | `{ id, status, rejectReason, category, draft, images: [{ id, url }] }` |
| `PATCH /business/discounts/<id>` | `{ draft, intent }` | `{ id, status }` — faol chegirmada mazmun o'zgarsa qayta `PENDING_REVIEW` |
| `POST /business/discounts/<id>/active` | `{ active }` | `{ ok, status }` (faqat `ACTIVE` ↔ `PAUSED`, aks holda `not_editable`) |
| `POST /business/discounts/<id>/images` | multipart `file` (rasm) | 201 `{ id, url }` · 4 tagacha (`too_many_files`) |
| `DELETE /business/discount-images/<id>` | — | `{ ok }` |
| `GET /business/cashiers` | — | `{ canInvite, cashiers: [{ memberId, firstName, lastName, phone, scansToday, shift: "on"\|"ended"\|"none" }], invites: [{ id, expiresAt, phone }] }` |
| `POST /business/cashiers` | `{ phone }` | 201 `{ invite: { id, phone, expiresAt } }` · `invalid_phone`, `already_cashier`, `too_many_invites` (10) |
| `DELETE /business/cashiers/<memberId>` | — | `{ ok }` — a'zolik yopiladi, kassirning barcha sessiyalari darhol o'chadi |
| `DELETE /business/invites/<id>` | — | `{ ok }` |
| `GET /business/orders` | `filter=new\|preparing\|ready\|done` | `{ enabled, orders, counts, newIds, report, now }` |
| `POST /business/orders/<id>` | `{ action: "accept" }` \| `{ action: "reject", reason }` \| `{ action: "ready" }` | `{ ok }` · `order_conflict` (holat o'zgargan) |
| `GET /business/profile` | — | `{ profile: { id, name, address, landmark, workingHours, description, status, publicPhone, telegram, instagram, kind, typeLabel, district, logoUrl, salesToday, revenueToday, activeDiscounts, preorderEnabled } }` |
| `PATCH /business/profile` | `{ name, address, workingHours, description, landmark?, phone?, telegram?, instagram? }` | `{ ok, rereview }` · `invalid_request` + `fields` |
| `POST /business/logo` · `DELETE /business/logo` | multipart `file` | `{ ok }` |

- `draft` — saytdagi muharrir bilan bir xil (`DiscountDraft`, `src/lib/discount.ts`): `title, type: "PERCENT"|"FIXED_PRICE"|"BOGO", originalPrice,
  percent, newPrice, weekdays (1=Du…7=Ya), fromMinute, toMinute, dailyLimit, perStudentLimit: "DAILY"|"WEEKLY"|"UNLIMITED", startsOn, endsOn
  ("YYYY-MM-DD", Toshkent), terms`. Tekshiruv `validateDiscount`: xato — `invalid_request` + `fields` + `problems` (`{ percent: "percentRange", … }`).
  Faol chegirmada rasm qo'shish/o'chirish ham qayta tekshiruvga tushiradi.
- Profil: nom yoki manzil o'zgarsa `rereview: true` — biznes `PENDING`, chegirmalar talabaga ko'rinmaydi, egasining bo'limlari tasdiqlanguncha
  `business_not_ready`. Ish vaqti, tavsif, mo'ljal va aloqa — tekshiruvsiz; aloqa maydoni berilmasa o'zgarmaydi, bo'sh qator — o'chadi.
- Buyurtmalar: holat faqat `transitionOrder` orqali (sig'im, pul, xabarnoma bitta joyda). `confirmBy` — shu vaqtgacha javob bo'lmasa avtomatik
  bekor (qo'lda tasdiq — 10 daq). Yangi to'langan buyurtmada egasiga push (pastda); ilova ochiq bo'lsa `newIds` da yangi id — tovush.

### Kassir qo'shish (telefon taklifi)

Egasi `POST /business/cashiers { phone }` — shu raqamga bog'langan taklif (48 soat, havolasiz). Raqam boshqa hisobniki bo'lsa ham javob bir
xil (raqam bor-yo'qligi egasiga oshkor qilinmaydi). Kassir ilovada **"Biznes"** bilan kiradi: `/auth/verify` → yangi raqam va taklif bor
bo'lsa `{ next: "setPassword", role: "cashier", businessName }` → `/auth/password` → `{ next: "register", role: "cashier" }` →
`POST /cashier/register { registrationTicket, firstName, lastName }` → 201 `SignedIn` (kassir). Avvalgi biznesdan chiqarilgan kassir
`/auth/verify` da taklifni avtomatik qabul qiladi. Taklif shu orada bekor qilingan/eskirgan — `no_business`. Saytdagi havola usuli o'zgarmagan.

## Fayllar

`GET /api/v1/files/<tur>/<id>?exp=&sig=` — `discount-image`, `logo`, `avatar`, `receipt` (PDF). Imzo (HMAC, server siri) API javobida faqat
ko'rishga ruxsati bor foydalanuvchiga beriladi (`signUrls`, `src/server/api/files.ts`), ya'ni havolaning o'zi ruxsat: `Authorization` sarlavhasi
kerak emas, `<Image source={{ uri }}>` va brauzer to'g'ridan-to'g'ri ochadi. Muddat soat boshiga yaxlitlanadi — bir soat ichida manzil
o'zgarmaydi (qurilma keshi ishlaydi), havola 1–2 soatda eskiradi (eskirsa ekranni yangilang — yangi havola keladi). Buzilgan/eskirgan/yo'q —
bir xil 404. Talaba endpoint'lari (`/deals`, `/deals/<id>`, `/saved`, `/deals/nearby`) ham shu havolalarni beradi.

## Push qurilmalari

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `POST /push/devices` | Bearer, `{ token, platform: "IOS"\|"ANDROID" }` | `{ ok }` — `PushDevice` (token yagona), joriy sessiyaga bog'lanadi |
| `DELETE /push/devices` | Bearer, `{ token }` | `{ ok }` |

Chiqish, bloklash, parolni tiklash yoki hisobni o'chirishda sessiya bilan birga qurilma yozuvi ham o'chadi.
Ilova (`mobile/`) **Expo push tokenini** yuboradi (`ExponentPushToken[…]`, `getExpoPushTokenAsync`; EAS `projectId` kerak).
Yuborish: `sendPushToUsers` (`notifications/push.ts`) Web Push bilan birga Expo Push API ga ham (`notifications/expo-push.ts`, 100 tadan) —
buyurtma xabarlari (yangi buyurtma — egasiga), tasdiq/rad xabarlari va admin bildirishnomalari ilovaga ham boradi. `data.url` — saytdagi yo'l
(`/biznes/buyurtmalar`, …), ilova shu bo'yicha ekran ochadi. `DeviceNotRegistered` — token o'chiriladi. `EXPO_ACCESS_TOKEN` (ixtiyoriy) —
Expo hisobida "Enhanced push security" yoqilgan bo'lsa.

## Hali yo'q

- Biznes ilovasida: oldindan buyurtma sozlamalari (rejim, jadval, to'lov — saytda), Excel hisobot, biznes bildirishnomalari ekrani
  (`GET /notifications` egasiga ochiq). Talaba: oldindan band qilish (buyurtma, to'lov).
- Talaba: kupon tarixi ro'yxati (bitta chek — `GET /receipts/<id>`), profilni tahrirlash (ism, kurs, fakultet, tuman),
  profil rasmi (`/api/avatar/<id>` cookie talab qiladi), bildirishnoma sozlamasi (saytdagi "Yangi chegirmalar haqida xabar"),
  eng yaqin metro (yo'nalish oynasida; havolalar mijozda). Ilovada shular hozircha yo'q yoki saytga ochiladi.
- Qurilmalar ro'yxati va boshqa sessiyalarni yopish; ru/en matnlar (xato matnlari faqat o'zbekcha).
