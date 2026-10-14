/**
 * Dizayn ekrani va ilova sahifasini bir xil kenglikda skrinshot qilib, yonma-yon bitta rasmga birlashtiradi.
 *
 *   node scripts/compare.mjs <ID> <yo'l> <kenglik> [--height=844] [--base=http://localhost:3000] [--click="selector"] [--cookie=nom=qiymat]
 *   node scripts/compare.mjs W1 / 1440
 *
 * Natija: .compare/<ID>-<kenglik>.png (chapda dizayn, o'ngda ilova) va farq foizi.
 * Dizayn fayllari design/screens dan lokal statik server orqali ochiladi.
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";

const [id, route, widthArg, ...rest] = process.argv.slice(2);
if (!id || !route || !widthArg) {
  console.error("Foydalanish: node scripts/compare.mjs <ID> <yo'l> <kenglik> [--height=N] [--base=URL] [--click=selector]");
  process.exit(1);
}
const opts = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split(/=(.*)/s).slice(0, 2)));
const width = Number(widthArg);
const height = Number(opts.height ?? 900);
const base = opts.base ?? "http://localhost:3000";
const out = opts.out ?? `${id}-${width}`;

const root = resolve("design/screens");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!path.startsWith(root)) throw new Error("tashqarida");
    const body = await readFile(path);
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const designUrl = `http://127.0.0.1:${server.address().port}/${id}.html`;

// To'liq Chromium: headless-shell kamera API'sini qo'llamaydi va T2 da keraksiz xabar chiqaradi.
const browser = await chromium.launch({ channel: "chromium" });
async function shoot(url, isDesign) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  // --cookie=nom=qiymat — ilovaga tayyor sessiya bilan kirish (scripts/compare-fixtures.mjs)
  if (opts.cookie && !isDesign) {
    const [name, value] = opts.cookie.split(/=(.*)/s);
    await context.addCookies([{ name, value, url: base }]);
  }
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important} *{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  // Ilovadagi qadamlar tartibi: --fill="selector::qiymat;;selector2::qiymat2" → --select="selector::yorliq" → --click → --type (klaviaturadan) → --blur
  if (opts.fill && !isDesign) {
    for (const pair of opts.fill.split(";;")) {
      const [selector, value] = pair.split("::");
      await page.fill(selector, value);
    }
  }
  if (opts.select && !isDesign) {
    const [selector, label] = opts.select.split("::");
    await page.selectOption(selector, { label });
  }
  if (opts.click && !isDesign) await page.click(opts.click);
  if (opts.type && !isDesign) {
    await page.waitForTimeout(Number(opts.wait ?? 1500));
    await page.keyboard.type(opts.type);
  }
  if (opts.blur && !isDesign) await page.evaluate(() => document.activeElement?.blur());
  // --designClick="sel1;;sel2" — dizaynda ketma-ket bosishlar (masalan, ikki marta "Davom etish")
  if (opts.designClick && isDesign) {
    for (const selector of opts.designClick.split(";;")) {
      await page.click(selector);
      await page.waitForTimeout(150);
    }
  }
  // --file="selector::nom.jpg" — ilovada kichik JPEG faylni tanlash (yuklash holatini ko'rsatish uchun)
  if (opts.file && !isDesign) {
    const [selector, name] = opts.file.split("::");
    const { default: sharp } = await import("sharp");
    const jpeg = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#e4e2db" } }).jpeg().toBuffer();
    await page.setInputFiles(selector, { name, mimeType: "image/jpeg", buffer: jpeg });
    await page.waitForTimeout(Number(opts.wait ?? 1500));
  }
  await page.waitForTimeout(300);
  const buffer = await page.screenshot({ fullPage: true });
  await context.close();
  return PNG.sync.read(buffer);
}

const design = await shoot(designUrl, true);
const app = await shoot(base + route, false);
await browser.close();
server.close();

const GAP = 24;
const h = Math.max(design.height, app.height);
const sheet = new PNG({ width: design.width + GAP + app.width, height: h });
sheet.data.fill(0x80);
for (let i = 3; i < sheet.data.length; i += 4) sheet.data[i] = 255;
PNG.bitblt(design, sheet, 0, 0, design.width, design.height, 0, 0);
PNG.bitblt(app, sheet, 0, 0, app.width, app.height, design.width + GAP, 0);

// Piksel farqi (umumiy maydon bo'yicha) va farq boshlanadigan birinchi qatorlar
const w = Math.min(design.width, app.width);
const hh = Math.min(design.height, app.height);
let diff = 0;
const rows = [];
for (let y = 0; y < hh; y++) {
  let rowDiff = 0;
  for (let x = 0; x < w; x++) {
    const a = (y * design.width + x) * 4;
    const b = (y * app.width + x) * 4;
    const d = Math.abs(design.data[a] - app.data[b]) + Math.abs(design.data[a + 1] - app.data[b + 1]) + Math.abs(design.data[a + 2] - app.data[b + 2]);
    if (d > 48) rowDiff++;
  }
  diff += rowDiff;
  if (rowDiff > 0) rows.push(y);
}
// Farqli qatorlarni oraliqlarga yig'ish
const bands = [];
for (const y of rows) {
  const last = bands[bands.length - 1];
  if (last && y - last[1] <= 6) last[1] = y;
  else bands.push([y, y]);
}

await mkdir(".compare", { recursive: true });
await writeFile(`.compare/${out}.png`, PNG.sync.write(sheet));
if (opts.diff) {
  // Farq xaritasi: mos piksellar xira, farqlilar qizil
  const map = new PNG({ width: w, height: hh });
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const a = (y * design.width + x) * 4, b = (y * app.width + x) * 4, o = (y * w + x) * 4;
      const d = Math.abs(design.data[a] - app.data[b]) + Math.abs(design.data[a + 1] - app.data[b + 1]) + Math.abs(design.data[a + 2] - app.data[b + 2]);
      const g = Math.round((app.data[b] + app.data[b + 1] + app.data[b + 2]) / 3 / 2 + 127);
      map.data[o] = d > 48 ? 255 : g; map.data[o + 1] = d > 48 ? 0 : g; map.data[o + 2] = d > 48 ? 0 : g; map.data[o + 3] = 255;
    }
  await writeFile(`.compare/${out}-diff.png`, PNG.sync.write(map));
}
console.log(
  JSON.stringify({
    file: `.compare/${out}.png`,
    design: `${design.width}x${design.height}`,
    app: `${app.width}x${app.height}`,
    diffPercent: Number(((diff / (w * hh)) * 100).toFixed(3)),
    diffBands: bands.slice(0, 40).map(([a, b]) => `${a}-${b}`),
  }),
);
