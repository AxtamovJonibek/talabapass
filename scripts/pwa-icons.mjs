/**
 * PWA ikonkalari: ko'k fon (#2433D6) ustida oq "ticket" (dizayn ikonkalaridan). `node scripts/pwa-icons.mjs`
 * Maskable — xavfsiz zona uchun belgi kichikroq (80%).
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const TICKET = "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10";
const svg = (size, scale) => {
  const s = (size * scale) / 24;
  const o = (size - 24 * s) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#2433D6"/>` +
      `<g transform="translate(${o} ${o}) scale(${s})" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${TICKET}"/></g></svg>`,
  );
};

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
