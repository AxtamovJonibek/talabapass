/* talabaPass service worker: (1) oflayn rejim — statik fayllar keshi, /oflayn sahifasi, ochilgan kupon sahifasi; (2) Web Push. */
const VERSION = "tp-v3";
const STATIC = VERSION + "-static";
const PAGES = VERSION + "-pages";
const OFFLINE = "/oflayn";
const COUPON = /^\/kuponlar\/[^/]+$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll([OFFLINE, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"].map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Eng so'nggi keshlangan kupon sahifasi (`/kuponlar` internetsiz ochilganda shu ko'rsatiladi). */
async function latestCouponPage() {
  const cache = await caches.open(PAGES);
  const keys = await cache.keys();
  const last = keys[keys.length - 1];
  return last ? cache.match(last) : undefined;
}

async function navigate(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    // Yo'naltirilgan javobni navigatsiya uchun qaytarib bo'lmaydi — keshlanmaydi
    if (response.ok && !response.redirected && COUPON.test(url.pathname)) {
      const copy = response.clone();
      caches.open(PAGES).then((cache) => cache.put(url.pathname, copy));
    }
    return response;
  } catch {
    const pages = await caches.open(PAGES);
    const cached = await pages.match(url.pathname);
    if (cached) return cached;
    if (url.pathname === "/kuponlar") {
      const latest = await latestCouponPage();
      if (latest) return latest;
    }
    return (await caches.match(OFFLINE)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    caches.open(STATIC).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});

// Sahifadan: { type: "warm", page, assets } — ochilgan kupon sahifasi va uning fayllarini keshlash;
// { type: "clear" } — chiqishda (kupon keyingi foydalanuvchiga qolmasin).
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "clear") {
    event.waitUntil(caches.delete(PAGES));
  } else if (data.type === "warm" && typeof data.page === "string" && COUPON.test(data.page)) {
    event.waitUntil(
      (async () => {
        const [pages, statics] = await Promise.all([caches.open(PAGES), caches.open(STATIC)]);
        const response = await fetch(data.page, { credentials: "same-origin" });
        if (!response.ok || response.redirected) return;
        // Sahifa HTML'idagi fayllar (hard reload'da kerak bo'ladi) + sahifa ochilganda yuklanganlar
        const html = await response.clone().text();
        await pages.put(data.page, response);
        const found = new Set(html.match(/\/_next\/static\/[^"'\s\\<>]+/g) || []);
        for (const rel of html.match(/"(static\/(?:chunks|media)\/[^"]+)"/g) || []) found.add("/_next/" + rel.slice(1, -1));
        for (const a of Array.isArray(data.assets) ? data.assets : []) if (typeof a === "string" && a.startsWith("/_next/static/")) found.add(a);
        await Promise.all([...found].map((a) => statics.add(a).catch(() => undefined)));
      })().catch(() => undefined),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "talabaPass", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "talabaPass", {
      body: data.body || "",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
