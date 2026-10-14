/**
 * Joylashuv tekshiruvi: elementlar bir-birining ustiga tushmasligi va bir-biriga yopishib qolmasligi.
 *   node scripts/layout-check.mjs <yo'l> <kengliklar,vergul bilan> --cookie=nom=qiymat
 * Hozircha: WT1 tekshiruv holati (muhr ↔ tavsif, chap sarlavha ↔ o'ng karta).
 */
import { chromium } from "@playwright/test";

const [route, widthsArg, ...rest] = process.argv.slice(2);
const opts = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split(/=(.*)/s).slice(0, 2)));
const base = opts.base ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: "chromium" });
let failed = false;
for (const width of widthsArg.split(",").map(Number)) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  if (opts.cookie) {
    const [name, value] = opts.cookie.split(/=(.*)/s);
    await context.addCookies([{ name, value, url: base }]);
  }
  const page = await context.newPage();
  await page.goto(base + route, { waitUntil: "networkidle" });
  const r = await page.evaluate(() => {
    const visible = (el) => el && el.offsetParent !== null;
    const stamp = [...document.querySelectorAll("[data-testid=status-stamp-web]")].find(visible);
    const main = stamp.closest("main");
    const lead = main.querySelector("p");
    const h1 = [...document.querySelectorAll("aside h1")].find(visible);
    // Sarlavhadagi eng keng satr — matn diapazoni orqali
    const range = document.createRange();
    range.selectNodeContents(h1);
    const textRight = Math.max(...[...range.getClientRects()].map((b) => b.right));
    const s = stamp.getBoundingClientRect(), p = lead.getBoundingClientRect(), m = main.getBoundingClientRect();
    // Tor ekranda karta sarlavha ostiga tushadi: unda yonma-yon oraliq tekshirilmaydi.
    const stacked = m.top >= h1.getBoundingClientRect().bottom;
    return { stampBottom: s.bottom, leadTop: p.top, overlap: !(s.bottom <= p.top || s.right <= p.left || s.left >= p.right), gap: stacked ? null : m.left - textRight };
  });
  const ok = !r.overlap && (r.gap === null || r.gap >= 24);
  failed ||= !ok;
  console.log(`${width}px  muhr↔tavsif: ${r.overlap ? "USTMA-UST" : `toza (muhr pasti ${r.stampBottom.toFixed(0)} ≤ matn ${r.leadTop.toFixed(0)})`}  sarlavha↔karta: ${r.gap === null ? "karta pastda" : r.gap.toFixed(0) + "px"}  ${ok ? "OK" : "XATO"}`);
  await context.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
