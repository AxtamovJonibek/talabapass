"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { APP_COOKIE } from "@/lib/app-mode";
import { isNativeApp } from "@/lib/native";

/**
 * Capacitor ilovasi ichida (brauzerda hech narsa qilmaydi):
 * - `tp_app` cookie (server ilova ko'rinishini beradi, `src/lib/app-mode.ts`); bosh sahifa (landing) o'rniga
 *   `/ilova` (tanishtiruv yoki kirish) — eski APK'lar `server.url` bilan landing'ni ochadi;
 * - splash sahifa chizilgach yopiladi (`/ilova` o'zi yopadi — karusel yoki kirishni tanlagach);
 * - status bar belgilari fonga mos: qora ekranlarda (`data-edge`, globals.css) oq, qolganida qora;
 * - Android "orqaga": tarix bo'lsa orqaga, aks holda ilova yopilmaydi — fonga o'tadi;
 * - ilgari ro'yxatdan o'tgan service worker bo'lsa olib tashlanadi (ilovada SW ishlatilmaydi).
 */
const isLanding = (path: string) => /^(\/[a-z]{2})?\/?$/.test(path);

/** Landing ilovada ko'rsatilmaydi (logotip havolasi, eski APK'ning `server.url` i) — tanishtiruv yoki kirish. Landing sahifasida turadi. */
export function AppLandingRedirect() {
  useEffect(() => {
    if (isNativeApp()) window.location.replace(`${window.location.pathname.replace(/\/$/, "")}/ilova`);
  }, []);
  return null;
}

export function NativeApp() {
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.native = "";
    const hasCookie = () => document.cookie.split("; ").includes(`${APP_COOKIE}=1`);
    const had = hasCookie();
    document.cookie = `${APP_COOKIE}=1; path=/; max-age=31536000; samesite=lax; secure`;
    // Birinchi marta (o'rnatilgandan keyin bir marta): server shu sahifani sayt ko'rinishida chizgan — ilova ko'rinishi uchun qayta yuklash.
    // Landing o'zi /ilova ga o'tadi. Cookie saqlanmasa (taqiqlangan) — qayta yuklanmaydi, tsikl yo'q.
    if (!had && hasCookie() && !isLanding(window.location.pathname)) {
      window.location.reload();
      return;
    }
    // Landing'da splash o'tish tugaguncha turadi (AppLandingRedirect), `/ilova` uni o'zi yopadi
    if (!isLanding(window.location.pathname) && !/\/ilova(\/|$)/.test(window.location.pathname)) SplashScreen.hide().catch(() => {});
    navigator.serviceWorker?.getRegistrations().then((list) => list.forEach((r) => r.unregister())).catch(() => {});

    let dark: boolean | null = null;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const next = document.querySelector("[data-edge]") !== null;
      if (next === dark) return;
      dark = next;
      StatusBar.setStyle({ style: next ? Style.Dark : Style.Light }).catch(() => {});
    };
    sync();
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(sync);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const back = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.minimizeApp().catch(() => {});
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      back.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  return null;
}
