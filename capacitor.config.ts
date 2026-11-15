import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Mobil ilova — talabapass.uz saytini o'raydigan Capacitor qobig'i (batafsil: docs/ilova.md).
 * Sahifalar serverdan yuklanadi; `capacitor/www` faqat bo'sh joy va tarmoq xatosi ekrani.
 * Bu fayl o'zgarsa: `npx cap sync android`.
 */
const config: CapacitorConfig = {
  appId: "uz.talabapass.app",
  appName: "TalabaPass",
  webDir: "capacitor/www",
  backgroundColor: "#F3F2EE",
  server: {
    url: "https://talabapass.uz",
    androidScheme: "https",
    cleartext: false,
    // Sayt ochilmasa (internet yo'q) — mahalliy ekran, "Qayta urinish" bilan
    errorPath: "offline.html",
  },
  android: {
    // Saytda ilovani tanish uchun (statistika, server log'lari); aniqlash baribir Capacitor.isNativePlatform() orqali
    appendUserAgent: "TalabaPassApp",
  },
  ios: {
    appendUserAgent: "TalabaPassApp",
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#F3F2EE",
      showSpinner: false,
    },
    StatusBar: {
      // Sayt `viewport-fit=cover` + env(safe-area-inset-*) bilan chetlarni o'zi to'ldiradi
      overlaysWebView: true,
      style: "LIGHT",
    },
    SystemBars: {
      // Android: --safe-area-inset-* o'zgaruvchilari (eski WebView'da env() 0 qaytaradi)
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
