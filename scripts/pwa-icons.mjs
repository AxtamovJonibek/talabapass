/**
 * PWA ikonkalari: ko'k fon (#2433D6) ustida oq "ticket" (dizayn ikonkalaridan). `node scripts/pwa-icons.mjs`
 * Maskable — xavfsiz zona uchun belgi kichikroq (80%).
 * `android/` bo'lsa (Capacitor) — launcher ikonkalari (adaptive ham) va splash rasmlari shu belgidan qayta yoziladi.
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";

const TICKET = "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10";
const BLUE = "#2433D6";
const PAPER = "#F3F2EE";
const ticket = (size, scale, stroke = "#FFFFFF") => {
  const s = (size * scale) / 24;
  const o = (size - 24 * s) / 2;
  return `<g transform="translate(${o} ${o}) scale(${s})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${TICKET}"/></g>`;
};
const svg = (size, scale, { bg = BLUE, round = false } = {}) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      (bg ? (round ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${bg}"/>` : `<rect width="${size}" height="${size}" fill="${bg}"/>`) : "") +
      ticket(size, scale) +
      `</svg>`,
  );

mkdirSync("public/icons", { recursive: true });
const out = [
  ["public/icons/icon-192.png", 192, 0.62],
  ["public/icons/icon-512.png", 512, 0.62],
  ["public/icons/maskable-512.png", 512, 0.46],
  ["public/icons/apple-touch-icon.png", 180, 0.62],
];
for (const [file, size, scale] of out) {
  await sharp(svg(size, scale)).png().toFile(file);
  console.log(file);
}

const res = "android/app/src/main/res";
if (existsSync(res)) {
  // Launcher: 48dp (eski), adaptive old qatlam 108dp (ko'rinadigani markazdagi ~66%)
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(densities)) {
    const dir = `${res}/mipmap-${d}`;
    await sharp(svg(48 * k, 0.62)).png().toFile(`${dir}/ic_launcher.png`);
    await sharp(svg(48 * k, 0.56, { round: true })).png().toFile(`${dir}/ic_launcher_round.png`);
    await sharp(svg(108 * k, 0.4, { bg: null })).png().toFile(`${dir}/ic_launcher_foreground.png`);
    console.log(dir);
  }
  writeFileSync(
    `${res}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BLUE}</color>\n</resources>\n`,
  );
  // Splash: qog'oz fon, markazda ko'k doirada belgi (o'lchamlar Capacitor shablonidagidek)
  const splashDirs = readdirSync(res).filter((d) => d.startsWith("drawable"));
  for (const dir of splashDirs) {
    const file = `${res}/${dir}/splash.png`;
    if (!existsSync(file)) continue;
    const { width, height } = await sharp(file).metadata();
    const badge = Math.round(Math.min(width, height) * 0.28);
    const icon = await sharp(svg(badge, 0.56, { round: true })).png().toBuffer();
    const png = await sharp({ create: { width, height, channels: 4, background: PAPER } })
      .composite([{ input: icon, gravity: "center" }])
      .png()
      .toBuffer();
    writeFileSync(file, png);
    console.log(file);
  }
}
