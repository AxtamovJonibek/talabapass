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
- Rasm manzillari (`images`, `logoUrl`) nisbiy (`/api/chegirma/rasm/<id>`) — sayt manziliga qo'shib oching.

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
| `POST /auth/verify` | `{ phone, code, intent: "student"\|"business" }` | `{ next: "password", ticket, role, masked, initial }` yoki `{ next: "setPassword", ticket, role, isNew }` · xato: `wrong_code`, `code_expired`, `code_locked`, `account_blocked`, `no_business`, `admin_not_supported` |
| `POST /auth/login` | `{ ticket, password, deviceName? }` | `SignedIn` · xato: `wrong_password` (+`left`), `password_locked` (+`retryInSeconds`; 5 xato → 15 daq), `step_expired` |
| `POST /auth/password` | `{ ticket, password, confirm, deviceName? }` | yangi raqam: `{ next: "register", role, registrationTicket }`; aks holda `{ next: "signedIn", tokens, user }` · xato: `weak_password` (≥ 8, harf + raqam), `password_mismatch`, `step_expired` |
| `POST /auth/refresh` | `{ refreshToken }` | `{ tokens }` · xato: `refresh_invalid`, `refresh_reused` |
| `POST /auth/logout` | Bearer (muddati o'tgani ham) | `{ ok: true }` — sessiya va unga bog'langan push qurilmasi o'chadi |

"Parolni unutdim": `verify` → `next: "password"` bo'lgan `ticket` bilan `POST /auth/password` — yangi parol, boshqa
barcha sessiyalar (sayt ham) yopiladi.

## Profil

| Endpoint | Kirish | Chiqish |
|---|---|---|
| `GET /me` | Bearer | `{ user: { id, phone, role, firstName, lastName, hasPassword, student: { status, publicId, course, faculty, districtId, cardExpiresAt, university } \| null, business: { id, name, status, submitted, rejectReason, memberRole } \| null } }` |
| `DELETE /me` | Bearer, `{ password }` | `{ ok: true }` · xato: `wrong_password`, `password_locked`, `open_orders` |

Hisobni o'chirish: qator qoladi (sotuv/kupon tarixi biznes hisobotlari uchun), shaxsiy ma'lumot tozalanadi, raqam
bo'shaydi (`deleted:<id>`; shu raqam bilan keyin yangi hisob ochsa bo'ladi), holat `DELETED`, barcha sessiyalar yopiladi.
Talabaning guvohnoma fayllari va profil rasmi o'chiriladi, faol kuponlar bekor. Biznes egasida chegirmalar talabaga
ko'rinmay qoladi, kassirlar chiqariladi. Pul hal bo'lmagan buyurtma bo'lsa — `open_orders` (`src/server/account.ts`).
