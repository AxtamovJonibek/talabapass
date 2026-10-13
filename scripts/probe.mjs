/**
 * Farq sababini topish: berilgan matnli elementni dizaynda va ilovada topib, o'zi va ota elementlarining
 * o'lchamlari hamda asosiy hisoblangan uslublarini yonma-yon chiqaradi.
 *
 *   node scripts/probe.mjs <ID> <yo'l> <kenglik> "<matn>" [--base=http://localhost:3000] [--depth=4]
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const [id, route, widthArg, text, ...rest] = process.argv.slice(2);
const opts = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const root = resolve("design/screens");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const browser = await chromium.launch();
async function probe(url) {
  const page = await browser.newPage({ viewport: { width: Number(widthArg), height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(
    ({ text, depth }) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) if (node.textContent.trim() === text) break;
      if (!node) return null;
      const rows = [];
      let el = node.parentElement;
      for (let i = 0; i < depth && el; i++, el = el.parentElement) {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        rows.push({
          tag: el.tagName.toLowerCase(),
          x: +r.x.toFixed(2), y: +(r.y + scrollY).toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
          display: s.display, font: `${s.fontSize}/${s.lineHeight} ${s.fontWeight}`, stretch: s.fontStretch,
          margin: s.margin, padding: s.padding, box: s.boxSizing, family: s.fontFamily.slice(0, 40),
        });
      }
      return rows;
    },
    { text, depth: Number(opts.depth ?? 4) },
  );
  await page.close();
  return result;
}
const design = await probe(`http://127.0.0.1:${server.address().port}/${id}.html`);
const app = await probe((opts.base ?? "http://localhost:3000") + route);
await browser.close();
server.close();
if (!design || !app) {
  console.log("Matn topilmadi:", { design: !!design, app: !!app });
} else {
  design.forEach((d, i) => {
    console.log(`#${i} dizayn`, JSON.stringify(d));
    console.log(`#${i} ilova `, JSON.stringify(app[i]));
  });
}
