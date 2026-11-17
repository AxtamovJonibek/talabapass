/**
 * Brend fayllarini joyiga qo'yadi: `node scripts/brand-assets.mjs`. Manba — design/brand/ (README va _build-logo.py o'sha yerda).
 * - public/: favicon (ico, svg, 16/32/48), apple-touch-icon, icon-192/512, icon-maskable-512, og-image, logo(-white).svg/png,
 *   brand/wordmark(-white).svg — sayt ichidagi `Logo` uchun bo'sh chetsiz nusxa (asl faylda atrofida bo'sh joy bor).
 * - mobile/assets/: Expo ikonkasi, Android adaptive old va monoxrom qatlami (66dp xavfsiz zonaga sig'dirilgan), bildirishnoma
 *   ikonkasi, splash (oq logotip, Android 12+ doirasiga sig'adigan kvadrat).
 * - android/ (Capacitor qobig'i) bo'lsa: launcher ikonkalari va splash.
 * Fayllar faqat ko'chiriladi yoki brend SVG'laridan chiziladi — yangi rang/shakl qo'shilmaydi.
 */
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const SRC = "design/brand";
const BLUE = "#2432D6";
const PAPER = "#F3F2EE";

const copy = (from, to) => {
  copyFileSync(`${SRC}/${from}`, to);
  console.log(to);
};

// --- Sayt
mkdirSync("public/brand", { recursive: true });
for (const f of ["favicon.ico", "favicon.svg", "favicon-16.png", "favicon-32.png", "favicon-48.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "og-image.png"]) {
  copy(f, `public/${f}`);
}
copy("talabapass-logo.svg", "public/logo.svg");
copy("talabapass-logo.png", "public/logo.png");
copy("talabapass-logo-white.svg", "public/logo-white.svg");
copy("talabapass-logo-white.png", "public/logo-white.png");

// Wordmark: "Pass" plashkasi butun balandlikni egallaydi (y −165.87…50.4), "t" chap chetda x≈5.4 dan boshlanadi.
const WORDMARK_VIEWBOX = "5 -165.87 1346.2 216.27";
for (const [from, to] of [
  ["talabapass-logo.svg", "public/brand/wordmark.svg"],
  ["talabapass-logo-white.svg", "public/brand/wordmark-white.svg"],
]) {
  const svg = readFileSync(`${SRC}/${from}`, "utf8").replace(/viewBox="[^"]+"/, `viewBox="${WORDMARK_VIEWBOX}"`);
  writeFileSync(to, svg);
  console.log(to);
}

// --- Expo ilovasi
copy("talabapass-icon-1024.png", "mobile/assets/icon.png");
copy("talabapass-notification-96.png", "mobile/assets/notification-icon.png");
copy("favicon-48.png", "mobile/assets/favicon.png");

/**
 * Android adaptive ikonka: launcher niqobi (doira, squircle…) 108dp qatlamdan faqat markazdagi 66dp xavfsiz doirani
 * kafolatlaydi. Brend old qatlamida chipta burchaklari va "%" belgisi undan chiqadi — mobil nusxada belgi butunligicha
 * kichraytiriladi (shakl va rang o'zgarmaydi), eng chetki piksel 64dp doira ichida qoladi.
 */
const SAFE_RADIUS = (32 / 108) * 1024;
async function fitSafeZone(input, output) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = info.width / 2;
  let max = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) max = Math.max(max, Math.hypot(x + 0.5 - c, y + 0.5 - c));
    }
  }
  const k = Math.min(1, SAFE_RADIUS / max);
  const size = Math.round(1024 * k);
  const small = await sharp(input).resize(size, size).png().toBuffer();
  const offset = Math.round((1024 - size) / 2);
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: small, left: offset, top: offset }])
    .png()
    .toFile(output);
  console.log(output, `(${Math.round(max)}px -> ${Math.round(max * k)}px, xavfsiz ${Math.round(SAFE_RADIUS)}px)`);
}
await fitSafeZone(readFileSync(`${SRC}/talabapass-adaptive-foreground-1024.png`), "mobile/assets/android-icon-foreground.png");

/**
 * Splash (expo-splash-screen, app.json `imageWidth: 192`): kvadrat shaffof rasm. Android 12+ splash ikonkasini 288dp maydonda
 * chizadi va faqat markazdagi 192dp doirani ko'rsatadi; plagin rasmni `imageWidth` kvadratga `contain` qiladi — demak rasm = shu
 * doira. Oq logotip (chetidagi bo'sh joysiz) burchaklari radiusning 86% ichida — chetlarda bo'sh joy qoladi. iOS'da ham shu rasm.
 */
const SPLASH = 1152; // 192dp × 6
const wordmark = await sharp(`${SRC}/talabapass-logo-white.png`).trim().toBuffer({ resolveWithObject: true });
const fit = (0.86 * SPLASH) / Math.hypot(wordmark.info.width, wordmark.info.height);
const logoW = Math.round(wordmark.info.width * fit);
const logoH = Math.round(wordmark.info.height * fit);
await sharp({ create: { width: SPLASH, height: SPLASH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(wordmark.data).resize(logoW, logoH).png().toBuffer(), left: Math.round((SPLASH - logoW) / 2), top: Math.round((SPLASH - logoH) / 2) }])
  .png()
  .toFile("mobile/assets/splash-icon.png");
console.log("mobile/assets/splash-icon.png", `${logoW}x${logoH} / ${SPLASH}`);

// Monoxrom (Android 13 mavzuli ikonka): bildirishnoma siluetini adaptive old qatlamdagi chipta joyi va o'lchamida chizamiz.
const silhouette = readFileSync(`${SRC}/talabapass-notification.svg`, "utf8").match(/<path d="([^"]+)"/)[1];
const monochrome = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><g transform="translate(512 512) scale(0.92) translate(-17 -19) rotate(-8)"><path d="${silhouette}" fill="#FFFFFF" fill-rule="evenodd"/></g></svg>`;
await fitSafeZone(await sharp(Buffer.from(monochrome)).png().toBuffer(), "mobile/assets/android-icon-monochrome.png");

// --- Capacitor qobig'i (android/)
const res = "android/app/src/main/res";
if (existsSync(res)) {
  const icon = readFileSync(`${SRC}/talabapass-icon-1024.png`);
  const mark = readFileSync(`${SRC}/talabapass-mark-1024.png`);
  const foreground = readFileSync(`${SRC}/talabapass-adaptive-foreground-1024.png`);
  const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><circle cx="512" cy="512" r="512"/></svg>`);
  const round = await sharp(icon).composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(densities)) {
    const dir = `${res}/mipmap-${d}`;
    await sharp(mark).resize(48 * k).png().toFile(`${dir}/ic_launcher.png`);
    await sharp(round).resize(48 * k).png().toFile(`${dir}/ic_launcher_round.png`);
    await sharp(foreground).resize(108 * k).png().toFile(`${dir}/ic_launcher_foreground.png`);
    console.log(dir);
  }
  writeFileSync(
    `${res}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BLUE}</color>\n</resources>\n`,
  );
  // Splash: qog'oz fon (capacitor.config.ts bilan bir xil), markazda belgi
  for (const dir of readdirSync(res).filter((d) => d.startsWith("drawable"))) {
    const file = `${res}/${dir}/splash.png`;
    if (!existsSync(file)) continue;
    const { width, height } = await sharp(file).metadata();
    const badge = await sharp(mark).resize(Math.round(Math.min(width, height) * 0.3)).png().toBuffer();
    const png = await sharp({ create: { width, height, channels: 4, background: PAPER } }).composite([{ input: badge, gravity: "center" }]).png().toBuffer();
    writeFileSync(file, png);
    console.log(file);
  }
}
