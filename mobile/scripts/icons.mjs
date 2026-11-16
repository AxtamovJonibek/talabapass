// Mobil ilova ikonkalari va splash. Loyiha ildizidan: node mobile/scripts/icons.mjs
// (sharp ildizdagi node_modules dan olinadi — mobil loyihaga qo'shilmaydi).
// - Ikonka: saytdagi scripts/pwa-icons.mjs bilan bir xil "ticket" belgisi, ko'k fon (iOS uchun alfa kanalsiz, 1024).
// - Splash: app-flow logotipi "talaba[Pass]" (Archivo 900/800, wdth 112) — ko'k fonda oq; glif yo'llari logo-paths.json da
//   (Archivo TTF dan opentype.js bilan bir marta olingan, 100 birlik o'lchamda) — sharp SVG matnni shriftsiz chizolmaydi.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const sharp = createRequire(`${process.cwd()}/package.json`)("sharp");
const glyphs = JSON.parse(readFileSync(new URL("./logo-paths.json", import.meta.url), "utf8"));

const TICKET = "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10";
const BLUE = "#2432D6";
const WHITE = "#FFFFFF";
const ticket = (size, scale, stroke = WHITE) => {
  const s = (size * scale) / 24;
  const o = (size - 24 * s) / 2;
  return `<g transform="translate(${o} ${o}) scale(${s})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${TICKET}"/></g>`;
};
const svg = (size, scale, bg, round = false, stroke) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    (bg ? (round ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${bg}"/>` : `<rect width="${size}" height="${size}" fill="${bg}"/>`) : "") +
    (scale ? ticket(size, scale, stroke) : "") + `</svg>`);

/**
 * Logotip (Main.dc.html: "talaba" 27px 900, oraliq 8px, "Pass" 22px 800 chipda — radius 9, padding 1/11/3). `k` — masshtab
 * (1 = dizayn px). Ko'k fonda: matn oq, chip oq, "Pass" ko'k.
 */
function logoSvg(k, { text = WHITE, chip = WHITE, chipText = BLUE } = {}) {
  const t = glyphs.talaba;
  const p = glyphs.pass;
  const ts = 0.27 * k; // 27px / 100 birlik
  const ps = 0.22 * k;
  const line = (g, s) => (g.ascender - g.descender) * s; // qator balandligi
  const tH = line(t, ts);
  const chipW = p.advance * ps + 22 * k;
  const chipH = line(p, ps) + 4 * k;
  const gap = 8 * k;
  const W = t.advance * ts + gap + chipW;
  const H = Math.max(tH, chipH);
  const pad = 4 * k;
  const tBase = (H - tH) / 2 + t.ascender * ts + pad;
  const chipX = t.advance * ts + gap + pad;
  const chipY = (H - chipH) / 2 + pad;
  const pBase = chipY + 1 * k + p.ascender * ps;
  return {
    width: Math.ceil(W + pad * 2),
    height: Math.ceil(H + pad * 2),
    body:
      `<g transform="translate(${pad} ${tBase}) scale(${ts})"><path fill="${text}" d="${t.d}"/></g>` +
      `<rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${9 * k}" fill="${chip}"/>` +
      `<g transform="translate(${chipX + 11 * k} ${pBase}) scale(${ps})"><path fill="${chipText}" d="${p.d}"/></g>`,
  };
}

const dir = "mobile/assets";
const opaque = (buf) => sharp(buf).flatten({ background: BLUE }).removeAlpha().png();
await opaque(svg(1024, 0.62, BLUE)).toFile(`${dir}/icon.png`);
await sharp(svg(1024, 0.4, null)).png().toFile(`${dir}/android-icon-foreground.png`);
await sharp(svg(1024, 0, BLUE)).png().toFile(`${dir}/android-icon-background.png`);
await sharp(svg(1024, 0.4, null, false, WHITE)).png().toFile(`${dir}/android-icon-monochrome.png`);
await sharp(svg(48, 0.62, BLUE)).png().toFile(`${dir}/favicon.png`);
// Android bildirishnoma kichik ikonkasi: faqat oq + shaffof (tizim o'zi bo'yaydi, rang — app.json expo-notifications)
await sharp(svg(96, 0.7, null, false, WHITE)).png().toFile(`${dir}/notification-icon.png`);

// Splash: shaffof fondagi logotip (fon rangi app.json da — #2432D6), 6x — katta ekranlarda ham tiniq
const logo = logoSvg(6);
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${logo.width}" height="${logo.height}">${logo.body}</svg>`)).png().toFile(`${dir}/splash-logo.png`);
console.log("ok", { splash: `${logo.width}x${logo.height}` });
