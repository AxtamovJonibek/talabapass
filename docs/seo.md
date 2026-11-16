# SEO va brend

## Hozirgi holat
- `SEO_INDEXABLE=false` (yoki yo'q): butun sayt `noindex, nofollow` (meta + `X-Robots-Tag`), `robots.txt` — `Disallow: /`.
  Sitemap baribir `/sitemap.xml` da (Search Console'ga oldindan berish mumkin).
- `SEO_INDEXABLE=true`: ochiq sahifalar indekslanadi; panel, kirish, ro'yxat va API — doim `noindex`.

Ochiq sahifalar ro'yxati bitta joyda — `src/lib/seo.ts` → `PUBLIC_PAGES` (sitemap, metadata, proxy shundan):
`/uz`, `/uz/ilova`, `/uz/huquqiy/maxfiylik`, `/uz/huquqiy/shartlar`, `/uz/huquqiy/biznes`, `/uz/hisobni-ochirish`.
Yangi ochiq sahifa: `PUBLIC_PAGES` ga qo'shing va sahifada `generateMetadata` → `pageMetadata(...)` qaytaring.
Qolgan barcha sahifalar ildiz layout'dagi `baseMetadata` dan `noindex` oladi (standart — yopiq).

| Qism | Joyi |
|---|---|
| title, description, canonical, Open Graph (`/og-image.png`), Twitter card, icons, manifest | `src/lib/seo.ts` (`baseMetadata`, `pageMetadata`) |
| `robots.txt` | `src/app/robots.ts` (`ROBOTS_DISALLOW`) |
| `sitemap.xml` | `src/app/sitemap.ts` |
| `X-Robots-Tag` | `src/proxy.ts` (sahifalar), `next.config.ts` → `headers()` (`/api/*` — doim) |
| JSON-LD | `Organization` + `WebSite` — landing; `BreadcrumbList` — `/ilova`, huquqiy, hisobni o'chirish (`src/components/seo/json-ld.tsx`) |
| www → asosiy domen | nginx (pastda) + zaxira: `next.config.ts` `redirects()` (host `www.talabapass.uz` → 301) |

## Indekslashni yoqish
1. Serverda `/etc/talabapass/env`: `SEO_INDEXABLE=true`.
2. Qayta deploy (qiymat build vaqtida ham o'qiladi — statik sahifalar va robots.txt): GitHub Actions → deploy → "Run workflow"
   yoki serverda `bash /var/www/talabapass/deploy/deploy.sh`.
3. Tekshiring:
   ```
   curl -s https://talabapass.uz/robots.txt                 # Allow: / , Disallow: /api/ ..., Sitemap: ...
   curl -sI https://talabapass.uz/uz | grep -i robots        # X-Robots-Tag yo'q
   curl -s https://talabapass.uz/uz | grep -o '<meta name="robots"[^>]*>'   # index, follow
   curl -sI https://talabapass.uz/uz/kirish | grep -i robots # noindex
   ```
4. Google Search Console (`public/googleafbb26fed356e93c.html` bilan tasdiqlangan): Sitemaps → `https://talabapass.uz/sitemap.xml`;
   URL Inspection → `https://talabapass.uz/uz` → "Request indexing". Yandex Webmaster'da ham xuddi shunday.
5. Ulashish rasmini tekshirish: Telegram'da havolani yuboring (yoki @WebpageBot ga yuborib keshni yangilang), Facebook Sharing Debugger.

O'chirish — `SEO_INDEXABLE=false` va qayta deploy. Allaqachon indekslangan sahifalar Search Console → Removals orqali tezroq olinadi.

## www → https://talabapass.uz (nginx, bir martalik)
Sertifikat `www.talabapass.uz` ni allaqachon qamraydi (SAN: `talabapass.uz`, `www.talabapass.uz`). Hozir www sayt o'zini beradi;
ilova darajasidagi 301 deploy'dan keyin ishlaydi, lekin nginx'da bitta sakrash bilan qilish to'g'riroq. Serverda (root):

```nginx
# /etc/nginx/sites-available/talabapass — mavjud `server_name talabapass.uz www.talabapass.uz;` bloklaridan www ni olib tashlang
# va shu ikki blokni qo'shing (sertifikat yo'llari mavjud bloknikidek):
server {
    listen 80;
    listen [::]:80;
    server_name www.talabapass.uz;
    return 301 https://talabapass.uz$request_uri;
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name www.talabapass.uz;
    ssl_certificate     /etc/letsencrypt/live/talabapass.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/talabapass.uz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    return 301 https://talabapass.uz$request_uri;
}
```

```
sudo nginx -t && sudo systemctl reload nginx
# Sertifikatda www bo'lmasa (yangi serverda): sudo certbot --nginx -d talabapass.uz -d www.talabapass.uz --expand
curl -sI http://www.talabapass.uz/uz/ilova  | grep -iE '^HTTP|location'   # 301 → https://talabapass.uz/uz/ilova
curl -sI https://www.talabapass.uz/uz/ilova | grep -iE '^HTTP|location'   # 301 → https://talabapass.uz/uz/ilova
```
`deploy.sh` nginx'ga tegmaydi (deploy foydalanuvchisi root emas) — bu sozlama bir marta qo'lda qilinadi.

## Brend fayllari
Manba — `design/brand/` (README, `_build-logo.py`). Joyiga qo'yish: `node scripts/brand-assets.mjs` — `public/` (favicon, ikonkalar, og-image, logo),
`public/brand/wordmark*.svg` (sayt ichidagi `Logo` uchun chetsiz nusxa), `mobile/assets/` (Expo ikonka, adaptive, monoxrom, bildirishnoma, splash)
va `android/` (Capacitor launcher/splash). Manifest — `public/site.webmanifest`. Fayllar o'zgarsa `public/sw.js` dagi `VERSION` ni oshiring.
