# 9-bosqich reja — biznes statistikasi (B6)

## 1. Xato: ro'yxatdan keyin /biznes
- Sabab: `/biznes` tasdiqlangan biznes uchun "quriladi" sahifasini (`PlaceholderHome`) ko'rsatardi; yuborishdan keyingi
  o'tish esa server action ichidagi `redirect` ga tayanardi.
- Tuzatish: yuborish `{ ok: true }` qaytaradi, klient `router.replace("/biznes")` qiladi (bitta aniq o'tish).
  `/biznes` holatlar bo'yicha: forma (yarim yo'lda / rad etilgan) · PENDING → tekshiruv sahifasi · APPROVED/WARNED → B6.
  `PlaceholderHome` biznes qismida qolmaydi.
- E2E: `e2e/business-home.spec.ts` — kirish → yo'naltirish har bir holat uchun (PENDING, APPROVED, REJECTED, yarim yo'lda).

## 2. Egasi skanerlaydi
`scannerFor` va `/biznes/skaner` egasiga ochiq (e2e `coupon.spec.ts`); bu bosqichda sidebar'ga "Skaner" qo'shiladi.

## 3. B6 — /biznes
- Davr: `?davr=1|7|30` (standart 30), tablar — havola; Excel: `/api/biznes/hisobot?davr=`.
- Manba: `src/server/business/stats.ts` (SQL, Toshkent vaqti = UTC+5), sof mantiq `src/lib/stats.ts` (vitest).
- KPI: sotuv soni, tushum (Σ paidAmount), o'rtacha chek, berilgan chegirma (Σ discountAmount), yangi mijoz
  (shu biznesdagi birinchi xaridi davr ichida), qayta kelganlar % (= davrdagi talabalardan yangi bo'lmaganlar).
- Grafik: 1 kun — soatlar, 7/30 — kunlar. Issiqlik xaritasi: oxirgi 30 kun, hafta kuni × soat, 5 daraja.
- Voronka: ko'rdi (`DiscountView`) → QR oldi (`Coupon`) → sotib oldi (`Redemption`). Universitetlar, chegirmalar jadvali,
  oxirgi sotuvlar (jonli: 30 s da yangilanadi), kassirlar (+ rad etilgan QR = `ScanAttempt` ≠ OK).
- "Sotuvlar va cheklar": `/biznes/sotuvlar` — davr bo'yicha ro'yxat, sahifalash, PDF chek.
- Mobil: shu bloklar telefon qobig'ida (pastki navigatsiya), jadvallar gorizontal aylanadi.
- Navigatsiya: veb — yon panel (Statistika, Chegirmalar, Sotuvlar, Kassirlar, Skaner, Profil); telefon — pastki.
- Tekshiruv: itest (qo'lda hisoblangan qiymatlar + mustaqil SQL), seed bazasida SQL bilan solishtirish, e2e, 390/1440.
