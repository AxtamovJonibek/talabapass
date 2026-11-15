// Mobil ilova ikonkalari: saytdagi scripts/pwa-icons.mjs bilan bir xil "ticket" belgisi. Loyiha ildizidan: node mobile/scripts/icons.mjs
// (sharp ildizdagi node_modules dan olinadi — mobil loyihaga qo'shilmaydi).
import { createRequire } from "node:module";
const sharp = createRequire(`${process.cwd()}/package.json`)("sharp");
const TICKET = "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10";
const BLUE = "#2432D6";
const ticket = (size, scale, stroke = "#FFFFFF") => {
  const s = (size * scale) / 24;
  const o = (size - 24 * s) / 2;
  return `<g transform="translate(${o} ${o}) scale(${s})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${TICKET}"/></g>`;
};
const svg = (size, scale, bg, round = false, stroke) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    (bg ? (round ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${bg}"/>` : `<rect width="${size}" height="${size}" fill="${bg}"/>`) : "") +
    (scale ? ticket(size, scale, stroke) : "") + `</svg>`);
const dir = "mobile/assets";
await sharp(svg(1024, 0.62, BLUE)).png().toFile(`${dir}/icon.png`);
await sharp(svg(1024, 0.4, null)).png().toFile(`${dir}/android-icon-foreground.png`);
await sharp(svg(1024, 0, BLUE)).png().toFile(`${dir}/android-icon-background.png`);
await sharp(svg(1024, 0.4, null, false, "#FFFFFF")).png().toFile(`${dir}/android-icon-monochrome.png`);
await sharp(svg(512, 0.56, BLUE, true)).png().toFile(`${dir}/splash-icon.png`);
await sharp(svg(48, 0.62, BLUE)).png().toFile(`${dir}/favicon.png`);
console.log("ok");
