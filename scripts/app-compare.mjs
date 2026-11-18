// Sayt (390px) va native ilova (Expo web) ekranlarini yonma-yon solishtirish — C qismi ("ilova = saytning telefon versiyasi").
//
//   1) npm run dev                                   (sayt, :3000, lokal baza + seed)
//   2) cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web --port 8081
//   3) node scripts/app-compare.mjs [--only=lenta,chegirma] [--out=.compare/app]
//
// Ikkala tomon bir xil hisob bilan (seed: talaba Dilnoza, Bodom Choyxonasi egasi, kassir; parol Talaba2026) kiradi.
// Natija: <out>/<ekran>.png (chapda sayt, o'ngda ilova, pastda farq xaritasi) va <out>/index.json (farq foizi).
// Farq foizi — rangi sezilarli farq qiladigan piksellar ulushi (piksel darajasidagi taqqoslash; antialiasing chegarasi 24).
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import pg from "pg";
import { PNG } from "pngjs";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";
const APP = process.env.APP_URL ?? "http://localhost:8081";
const PASSWORD = process.env.COMPARE_PASSWORD ?? "Talaba2026";
const W = 390;
const H = 844;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const OUT = args.out ?? ".compare/app";
const ONLY = args.only ? new Set(args.only.split(",")) : null;

async function fixtures() {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const student = await one(`SELECT id, phone FROM "User" WHERE phone = '+998904123785'`);
  const owner = await one(`SELECT u.id, u.phone FROM "User" u JOIN "Business" b ON b."ownerId" = u.id WHERE b.name = 'Bodom Choyxonasi'`);
  const cashier = await one(`SELECT u.phone FROM "User" u JOIN "BusinessMember" m ON m."userId" = u.id WHERE u.role = 'CASHIER' AND m.active LIMIT 1`);
  const deal = await one(`SELECT d.id FROM "Discount" d JOIN "Business" b ON b.id = d."businessId" WHERE d.status = 'ACTIVE' AND b.name = 'Qahva Bekati' LIMIT 1`);
  const ownDeal = await one(`SELECT d.id FROM "Discount" d JOIN "Business" b ON b.id = d."businessId" WHERE b.name = 'Bodom Choyxonasi' ORDER BY d."createdAt" LIMIT 1`);
  const receipt = await one(`SELECT id FROM "Redemption" WHERE "studentId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [student.id]);
  await db.end();
  return { student, owner, cashier, deal, ownDeal, receipt };
}

/** Ekranlar: sayt manzili ↔ ilova manzili (expo-router web). `role` — kim bo'lib kiriladi. */
const screens = (f) => [
  { name: "lenta", role: "student", site: "/uz/chegirmalar", app: "/deals" },
  { name: "chegirma", role: "student", site: `/uz/chegirmalar/${f.deal.id}`, app: `/deal/${f.deal.id}` },
  { name: "kuponlar", role: "student", site: "/uz/kuponlar", app: "/coupon" },
  { name: "tarix", role: "student", site: "/uz/tarix", app: "/history" },
  { name: "chek", role: "student", site: `/uz/tarix?chek=${f.receipt?.id ?? ""}`, app: `/receipt/${f.receipt?.id ?? ""}` },
  { name: "buyurtmalar", role: "student", site: "/uz/buyurtmalar", app: "/orders" },
  { name: "profil", role: "student", site: "/uz/profil", app: "/profile" },
  { name: "profil-tahrir", role: "student", site: "/uz/profil/tahrir", app: "/profile/edit" },
  { name: "guvohnoma", role: "student", site: "/uz/profil/guvohnoma", app: "/profile/card" },
  { name: "bildirishnomalar", role: "student", site: "/uz/bildirishnomalar", app: "/notifications" },
  { name: "yordam", role: "student", site: "/uz/yordam", app: "/help" },
  { name: "biznes-statistika", role: "owner", site: "/uz/biznes", app: "/panel/stats" },
  { name: "biznes-chegirmalar", role: "owner", site: "/uz/biznes/chegirmalar", app: "/panel/discounts" },
  { name: "biznes-muharrir", role: "owner", site: `/uz/biznes/chegirma/${f.ownDeal.id}`, app: `/biz/discount/${f.ownDeal.id}` },
  { name: "biznes-buyurtmalar", role: "owner", site: "/uz/biznes/buyurtmalar", app: "/biz/orders" },
  { name: "biznes-kassirlar", role: "owner", site: "/uz/biznes/kassirlar", app: "/biz/cashiers" },
  { name: "biznes-profil", role: "owner", site: "/uz/biznes/profil", app: "/panel/profile" },
  { name: "biznes-tahrir", role: "owner", site: "/uz/biznes/profil/tahrir", app: "/biz/edit" },
  { name: "biznes-sozlamalar", role: "owner", site: "/uz/biznes/sozlamalar", app: "/biz/settings" },
  { name: "biznes-sotuvlar", role: "owner", site: "/uz/biznes/sotuvlar", app: "/panel/sales" },
  { name: "skaner", role: "cashier", site: "/uz/biznes/skaner", app: "/panel/scan" },
];

async function siteContext(browser, phone) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "uz-UZ", timezoneId: "Asia/Tashkent" });
  const page = await context.newPage();
  await page.goto(`${SITE}/uz/kirish`, { waitUntil: "networkidle" });
  await page.locator("#login-identifier").fill(phone.replace(/^\+998/, ""));
  await page.locator("#login-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/kirish"), { timeout: 30_000 });
  // Toshkent tumani tanlangan (masofa ikkala tomonda bir xil)
  await page.close();
  return context;
}

async function appContext(browser, phone) {
  const res = await fetch(`${SITE}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: phone, password: PASSWORD, deviceName: "compare" }) });
  const { tokens } = await res.json();
  if (!tokens) throw new Error(`Ilova kirishi bo'lmadi: ${phone}`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "uz-UZ", timezoneId: "Asia/Tashkent" });
  await context.addInitScript((t) => {
    localStorage.setItem("tp.access", t.accessToken);
    localStorage.setItem("tp.accessExp", t.accessTokenExpiresAt);
    localStorage.setItem("tp.refresh", t.refreshToken);
    localStorage.setItem("tp.lang", "uz");
    localStorage.setItem("tp.onboarded.student", "1");
    localStorage.setItem("tp.onboarded.business", "1");
  }, tokens);
  return context;
}

async function shot(context, url, inApp = false) {
  const page = await context.newPage();
  try {
    if (inApp) {
      // Ilova ishga tushish ekranidan (`index.tsx`: sessiya va foydalanuvchi) o'tadi, keyin ichki navigatsiya
      const { origin, pathname, search } = new URL(url);
      await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForURL((u) => u.pathname !== "/", { timeout: 30_000 });
      await page.waitForTimeout(1500);
      if (new URL(page.url()).pathname + new URL(page.url()).search !== pathname + search) {
        await page.evaluate((to) => {
          history.pushState({}, "", to);
          dispatchEvent(new PopStateEvent("popstate"));
        }, pathname + search);
      }
      await page.waitForLoadState("networkidle", { timeout: 30_000 });
    } else await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  } catch {
    // ochiq so'rovlar (polling) — baribir rasmga olamiz
  }
  await page.waitForTimeout(4000);
  const buf = await page.screenshot({ animations: "disabled" });
  await page.close();
  return PNG.sync.read(buf);
}

function compose(a, b) {
  const gap = 12;
  const out = new PNG({ width: W * 3 + gap * 2, height: H, fill: true });
  let diff = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const ra = a.data.slice(i, i + 4);
      const rb = b.data.slice(i, i + 4);
      const d = Math.abs(ra[0] - rb[0]) + Math.abs(ra[1] - rb[1]) + Math.abs(ra[2] - rb[2]);
      const o1 = (y * out.width + x) * 4;
      const o2 = (y * out.width + x + W + gap) * 4;
      const o3 = (y * out.width + x + 2 * (W + gap)) * 4;
      for (let k = 0; k < 4; k++) {
        out.data[o1 + k] = ra[k];
        out.data[o2 + k] = rb[k];
      }
      const gray = Math.round((ra[0] + ra[1] + ra[2]) / 3 / 3 + 170);
      if (d > 24 * 3) {
        diff++;
        out.data.set([228, 35, 12, 255], o3);
      } else out.data.set([gray, gray, gray, 255], o3);
    }
  }
  return { png: out, percent: (diff / (W * H)) * 100 };
}

const f = await fixtures();
const browser = await chromium.launch({ args: ["--disable-web-security"] });
await mkdir(OUT, { recursive: true });
const phones = { student: f.student.phone, owner: f.owner.phone, cashier: f.cashier.phone };
const contexts = {};
const results = [];
for (const s of screens(f)) {
  if (ONLY && !ONLY.has(s.name)) continue;
  contexts[s.role] ??= { site: await siteContext(browser, phones[s.role]), app: await appContext(browser, phones[s.role]) };
  const [a, b] = [await shot(contexts[s.role].site, SITE + s.site), await shot(contexts[s.role].app, APP + s.app, true)];
  const { png, percent } = compose(a, b);
  await writeFile(join(OUT, `${s.name}.png`), PNG.sync.write(png));
  results.push({ name: s.name, site: s.site, app: s.app, diffPercent: Number(percent.toFixed(2)) });
  console.log(`${s.name.padEnd(22)} ${percent.toFixed(2).padStart(6)}%  ${s.site}  ↔  ${s.app}`);
}
await writeFile(join(OUT, "index.json"), JSON.stringify(results, null, 2));
await browser.close();
