"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeApp } from "@/lib/native";

/**
 * Capacitor ilovasi ichida (brauzerda hech narsa qilmaydi):
 * - splash sahifa chizilgach yopiladi;
 * - status bar belgilari fonga mos: qora ekranlarda (`data-edge`, globals.css) oq, qolganida qora;
 * - Android "orqaga": tarix bo'lsa orqaga, aks holda ilova yopilmaydi — fonga o'tadi;
 * - ilgari ro'yxatdan o'tgan service worker bo'lsa olib tashlanadi (ilovada SW ishlatilmaydi).
 */
export function NativeApp() {
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.dataset.native = "";
    SplashScreen.hide().catch(() => {});
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
