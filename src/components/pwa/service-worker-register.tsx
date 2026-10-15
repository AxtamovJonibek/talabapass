"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

const COUPON_PAGE = /^\/kuponlar\/[^/]+$/;

/**
 * Service worker'ni ro'yxatdan o'tkazadi (faqat production — dev'da keshlanadigan fayllar tez-tez o'zgaradi; sinash uchun NEXT_PUBLIC_SW=1).
 * - Ochilgan kupon sahifasi (`/kuponlar/<id>`) va uning fayllari keshlanadi: internet o'chsa ham QR ochiladi.
 * - `/kirish` ochilganda (chiqishdan keyin) kupon keshi tozalanadi.
 */
export function ServiceWorkerRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if ((process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SW !== "1") || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    (async () => {
      const registration = await navigator.serviceWorker.register("/sw.js").catch(() => null);
      if (!registration || cancelled) return;
      const ready = await navigator.serviceWorker.ready;
      const worker = ready.active;
      if (!worker || cancelled) return;
      if (COUPON_PAGE.test(pathname)) {
        // Sahifa to'liq yuklanib, ketma-ket (lazy) fayllar ham kelgach — shundagina ro'yxat olinadi
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (cancelled) return;
        const assets = performance
          .getEntriesByType("resource")
          .map((e) => new URL(e.name).pathname)
          .filter((p) => p.startsWith("/_next/static/"));
        worker.postMessage({ type: "warm", page: pathname, assets });
      } else if (pathname.startsWith("/kirish")) {
        worker.postMessage({ type: "clear" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
