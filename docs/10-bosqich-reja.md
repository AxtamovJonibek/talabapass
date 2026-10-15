# 10-bosqich reja — admin: A1 umumiy, tranzaksiyalar, bloklanganlar, A3 bildirishnomalar

## 1. Sahifalar (admin yon paneli to'liq, bo'sh band yo'q)
| Band | Manzil | Manba |
|---|---|---|
| Umumiy | `/admin` | A1 (KPI, 30 kunlik grafik, kategoriyalar, universitetlar, bizneslar reytingi) |
| Talabalar tekshiruvi | `/admin/talabalar` | A2 (bor) |
| Bizneslar | `/admin/bizneslar` | A2 (bor) |
| Chegirmalar | `/admin/chegirmalar` | A2 (bor) |
| Tranzaksiyalar | `/admin/tranzaksiyalar` | A1 pastki jadvalidan alohida sahifa: filtr, qidiruv, sahifalash, Excel eksport |
| Bildirishnomalar | `/admin/bildirishnomalar` | A3 |
| Bloklanganlar | `/admin/bloklanganlar` | A1 yon panelidagi band: talabalar / bizneslar, sabab, blokdan chiqarish |

`homePathFor("ADMIN")` → `/admin` (TODO bajariladi). `/admin` tekshiruvga yo'naltirmaydi.

## 2. A1 — `/admin`
- Manba: `src/server/admin/overview.ts` (SQL/Prisma, Toshkent vaqti), sof mantiq `src/lib/admin-stats.ts` (vitest).
- KPI: tasdiqlangan talabalar (+bugun), faol bizneslar (+faol chegirmalar), bugungi sotuvlar (o'tgan haftaning shu kuniga
  nisbatan %), talabalar bugun tejadi (+tushum), tekshiruv navbati (talaba + biznes).
- Grafik: 30 kun, ustun = sotuvlar, chiziq = yangi tasdiqlangan talabalar ×10 (dizayndagidek). Kategoriyalar ulushi (30 kun,
  eng kattalari + "Boshqa"), universitetlar (tasdiqlangan talaba, top 5), bizneslar reytingi (30 kun sotuvi bo'yicha, top 6).
- Qidiruv maydoni (dizaynda bor) — `/admin/tranzaksiyalar?q=` ga GET.
- Reytingda "Ko'rish" → `/admin/bizneslar?id=`; "Bloklash" — mavjud `blockBusinessAction` (sabab tanlanadi, confirm).

## 3. Tranzaksiyalar
- Qatorlar: muvaffaqiyatli = `Redemption`, rad etilgan = `ScanAttempt` (result ≠ OK, kuponi bor). Filtr: holat (hammasi / muvaffaqiyatli /
  rad etilgan), davr (bugun / 7 / 30 kun / hammasi), qidiruv (chek №, talaba ismi/telefoni, biznes nomi/STIR).
- Sahifalash: 25 tadan, `?sahifa=`. Ikki manba birlashtiriladi (har biridan `sahifa×25` ta olinib vaqt bo'yicha saralanadi).
- Eksport: `/api/admin/tranzaksiyalar/eksport` (Excel, `getUnlockedAdmin`, filtr bilan bir xil, 5000 qatorgacha), audit `transactions.export`.

## 4. Bloklanganlar
- Ikki tab: talabalar (`User.status=BLOCKED`, `role=STUDENT`) va bizneslar (`Business.status=BLOCKED`). Sabab, sana (audit logdan), kim blokladi.
- **Blokdan chiqarish** (`moderation.ts` ga `unblockUser`, `unblockBusiness`; bitta tranzaksiya + audit `user.unblock`, `business.unblock`):
  - talaba: `ACTIVE`; profil — guvohnoma muddati o'tmagan va raqami bor → `APPROVED`, muddati o'tgan → `EXPIRED`, aks holda `REJECTED`
    (qaytadan guvohnoma yuklaydi);
  - biznes: ilgari tasdiqlangan (audit `business.approve` bor) → `APPROVED`, aks holda `PENDING` (navbatga qaytadi).
  Sessiyalar qaytmaydi — foydalanuvchi qaytadan kiradi.

## 5. Bildirishnomalar (A3)
### 5.1 Ma'lumot
Sxema tayyor (`Notification`, `UserNotification`, `PushSubscription`). Migratsiya: `Audience` ga `USER` (bitta foydalanuvchiga
tizim xabari — tasdiq/rad) qo'shiladi; `/admin/bildirishnomalar` tarixida ko'rsatilmaydi.
### 5.2 Auditoriya (`src/server/notifications/audience.ts`)
- `ALL_STUDENTS` — `APPROVED` talabalar (bloklanmagan).
- `UNIVERSITY` — tanlangan universitetlar talabalari (ko'p tanlov, qamrov — jonli hisob).
- `DISTRICT` — **talabaning tumani bazada yo'q**; shuning uchun: oxirgi 90 kunda shu tumandagi biznesdan kupon olgan tasdiqlangan talabalar.
  (Qaror egasiga: kerak bo'lsa profilga tuman qo'shiladi.)
- `BUSINESSES` — tasdiqlangan (APPROVED/WARNED) biznes egalari.
### 5.3 Yuborish
- `createNotification` (zod: sarlavha ≤ 50, matn ≤ 150, havola turi, vaqt kelajakda ≤ 90 kun; audit `notification.create`).
- "Hozir": yaratilgach `after()` ichida `dispatchNotification`. "Rejalashtirish": `scheduledAt` (Toshkent vaqti, standart ertaga 08:30).
- `dispatchNotification(id)`: `UPDATE … SET status='SENDING' WHERE id=? AND status='SCHEDULED' AND scheduledAt<=now()` (atom — ikki marta
  yuborilmaydi) → qabul qiluvchilar `UserNotification` (`createMany skipDuplicates`) → Web Push (50 tadan paketlar, 404/410 → obuna o'chadi)
  → `delivered` = ilova ichi qabul qiluvchilar, status `SENT`; xato bo'lsa `FAILED`. "Ochildi" = `readAt` bor qatorlar ulushi (hisoblanadi).
- Ilova ichi: talaba `/bildirishnomalar` (qo'ng'iroq → shu sahifa, o'qilgan deb belgilanadi), biznes egasi `/biznes/bildirishnomalar`.
  Push yoqish tugmasi shu sahifalarda (`/api/push/obuna`, `public/sw.js`).
- Havola: `HOME` (rol bosh sahifasi), `CATEGORY` (lenta filtri), `DISCOUNT` (`/chegirmalar/<id>`).
### 5.4 Tasdiq/rad xabarlari (TODO(10-bosqich))
`approveStudent/rejectStudent`, `approveBusiness/rejectBusiness` — tranzaksiya commit'idan KEYIN `notifyUser` (ilova ichi + push + SMS),
xato qarorga ta'sir qilmaydi (`try/catch`, log). Matnlar `messages/uz.json` → `notifications.direct`.

## 6. Rejalashtirilgan xabarlar — Vercel Hobby cron'i kuniga 1 marta
Muammo: Hobby'da `*/5 * * * *` kabi jadval deploy'ni rad etadi. Yechim (uch qatlam, biri ishlamasa boshqasi tutadi):
1. **Asosiy — GitHub Actions** (`.github/workflows/cron.yml`, har 5 daqiqada, bepul): `curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/bildirishnomalar`.
   Repo secrets: `CRON_SECRET`, `APP_URL`. (Muqobil: cron-job.org — shu manzilga, shu sarlavha bilan.)
2. **Zaxira — Vercel kunlik cron** (`vercel.json`, kuniga 1 marta) — xuddi shu endpoint.
3. **Lazy** — admin bildirishnomalar sahifasi ochilganda muddati kelgan xabarlar yuboriladi.
Endpoint `CRON_SECRET` bilan himoyalangan (boshqalarga 404), idempotent (atom "claim"), `SENDING` da 15 daqiqadan oshib qolgani `FAILED` bo'ladi.

## 7. Vercel env (yangi)
| O'zgaruvchi | Qiymat |
|---|---|
| `VAPID_PUBLIC_KEY` | `npm run push:keys` chiqargan ochiq kalit |
| `VAPID_PRIVATE_KEY` | shu skript chiqargan yopiq kalit (sir) |
| `VAPID_SUBJECT` | `mailto:<egasi emaili>` |
| `CRON_SECRET` | allaqachon bor (kuponlar uchun) — GitHub Actions'ga ham shu qiymat |
Kalitlar bo'lmasa push o'chiq (ilova ichi xabarlar ishlayveradi); faqat bittasi bo'lsa `env-check` xato beradi.
GitHub: Settings → Secrets → `CRON_SECRET`, `APP_URL=https://talabapass.vercel.app`.

## 8. Tekshiruv
- vitest: `admin-stats` (ulush, farq %, grafik), bildirishnoma qoidalari (zod, rejalashtirish vaqti), push yuklama.
- itest: auditoriya tanlash (har tur), atom claim (parallel ikki yuborish — bir marta), kelajakdagi xabar yuborilmaydi, tasdiq/rad xabari,
  blokdan chiqarish (talaba/biznes holatlari), tranzaksiyalar so'rovi (filtr, sahifalash).
- e2e: `e2e/admin-overview.spec.ts` — barcha yon panel bandlari ochiladi, A1 raqamlari SQL bilan mos, xabar yuborish → talaba qo'ng'irog'ida ko'rinadi,
  rol matritsasi (`auth.spec.ts`) yangi sahifalar bilan.
- `design:compare` — A1 va A3, 390 va 1440.
