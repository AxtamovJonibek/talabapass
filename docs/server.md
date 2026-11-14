# Server: Airnet VPS (talabapass.uz)

## Arxitektura
```
main'ga push → GitHub Actions (.github/workflows/deploy.yml) → SSH → /var/www/talabapass/deploy/deploy.sh
internet → nginx (TLS, talabapass.uz) → 127.0.0.1:3000 → PM2 "talabapass" (cluster, 2 nusxa, next start)
                                                          └ PostgreSQL · fayllar lokal diskda (STORAGE_LOCAL_DIR)
```
- Kod: `/var/www/talabapass` (git clone, `origin` → GitHub; serverda o'qish uchun deploy key). Qo'lda o'zgartirilmaydi — har deploy `git reset --hard origin/main`.
- Muhit: `/etc/talabapass/env` (faqat deploy foydalanuvchisi o'qiydi, `chmod 600`). Uni ham bash (`source`), ham Node (`--env-file`) o'qiydi —
  `KALIT=qiymat` qatorlari, maxsus belgili qiymat qo'shtirnoqda, `export` yo'q.
- Port: `next start -p 3000` `-H` siz (Next 16.4.6 da `-H` berilsa `experimental.trustHostHeader` e'tiborsiz qoladi va nginx orqasida "/" → "/" cheksiz 307).
  Shuning uchun 3000-port faqat UFW bilan yopiq bo'lishi shart (ochiq: 22/80/443); nginx `127.0.0.1:3000` ga proksi qiladi.
- PM2: `ecosystem.config.cjs` (repo ildizi). Ilova muhitni faqat `--env-file` dan oladi (deploy PM2'ni toza muhit bilan chaqiradi). Qayta yoqilganda
  ko'tarilishi uchun bir marta: `pm2 startup` (chiqqan buyruqni bajaring); har deploy `pm2 save` qiladi.
- Nusxalar: har deploy oldidan `pg_dump -Fc` → `/var/backups/talabapass/pre-deploy-<sana>.dump`, oxirgi 10 tasi saqlanadi.
  `pg_dump` versiyasi baza serveridagidan eski bo'lmasin.
- Fayllar (guvohnoma, hujjatlar, rasmlar): `STORAGE_DRIVER=local`, `STORAGE_LOCAL_DIR` — kod papkasidan tashqarida absolyut yo'l
  (masalan `/var/lib/talabapass/files`, faqat ilova foydalanuvchisi o'qiydi; nginx orqali berilmaydi). Nisbiy yo'l bilan server ishga tushmaydi.
  Bu papka `pg_dump` nusxasiga kirmaydi — alohida zaxiralang.
- nginx `X-Forwarded-For` ni o'zi yozsin (`proxy_set_header X-Forwarded-For $remote_addr;`) — SMS chegarasi IP'ni shundan oladi.
- Serverda `APP_ENV=staging` (Vercel sinov serveri bilan bir xil qoidalar: noindex, SMS ulanguncha `OTP_FIXED_CODE`).

## deploy.sh nima qiladi
qulf (`flock`, ikki deploy bir vaqtda emas) → env → `git fetch` + `reset --hard origin/main` → `npm ci` → `check-env` → `pg_dump` →
`prisma migrate deploy` → universitetlar sinxroni → `next build` → `pm2 startOrReload` → `http://127.0.0.1:3000/` 30 s ichida 200/3xx.
Reset'dan keyingi istalgan qadam yiqilsa yoki sayt javob bermasa — eski commit'ga qaytadi, qayta build + reload qiladi va xato kodi bilan chiqadi.
Seed, `migrate dev`, `migrate reset` hech qachon chaqirilmaydi.

Cheklovlar:
- Build joyida (`.next`) bo'ladi — build davomida (bir necha daqiqa) ishlab turgan nusxalar ayrim sahifalarda xato berishi mumkin.
- Migratsiyalar orqaga qaytarilmaydi: orqaga qaytishda eski kod yangi sxema bilan ishlaydi. Migratsiyalar orqaga mos yozilsin.
- `deploy.sh` ning o'zidagi o'zgarish keyingi deploy'dan kuchga kiradi (ishlab turgan nusxa eski matnni bajaradi).

## Qo'lda deploy
```
ssh <user>@<host> 'bash /var/www/talabapass/deploy/deploy.sh'
```
yoki GitHub → Actions → deploy → Run workflow. Jurnal: `pm2 logs talabapass`, holat: `pm2 status`.

## Orqaga qaytarish
- Kod: `main` da `git revert <commit>` → push (avtomatik deploy). Shoshilinch: serverda
  `cd /var/www/talabapass && git reset --hard <commit> && npm ci --include=dev && npm run build && pm2 reload ecosystem.config.cjs`
  (keyingi push yana `origin/main` ga qaytaradi).
- Baza (oxirgi chora, deploy'dan keyingi yozuvlar yo'qoladi): ilovani to'xtating (`pm2 stop talabapass`), so'ng
  `pg_restore --clean --if-exists --no-owner -d "<DATABASE_URL>" /var/backups/talabapass/pre-deploy-<sana>.dump`, kodni mos commit'ga qaytaring, `pm2 start`.

## Env nomlari (`/etc/talabapass/env`, qiymatlar bu yerda yo'q)
| Guruh | Nomlar |
|---|---|
| Asosiy | `NODE_ENV=production`, `APP_ENV`, `AUTH_SECRET`, `ADMIN_PASSWORD_HASH` |
| Baza | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (ixtiyoriy, migratsiya uchun) |
| Fayllar | `STORAGE_DRIVER=local`, `STORAGE_LOCAL_DIR` (absolyut yo'l); S3 tanlansa — `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| Kirish | `SMS_PROVIDER`, `OTP_FIXED_CODE` (faqat `APP_ENV=staging`) |
| Cron | `CRON_SECRET` |
| Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (uchalasi birga yoki hech biri) |
| Ixtiyoriy | `TELEGRAM_BOT_TOKEN`, `SUPPORT_PHONE`, `SUPPORT_TELEGRAM` |

To'liq tekshiruv: `npx tsx scripts/check-env.mts` (deploy ham shuni chaqiradi). Kalitlar haqida: `docs/ishga-tushirish.md`.

GitHub secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS` (deploy); `CRON_SECRET`, `APP_URL` (cron.yml).
