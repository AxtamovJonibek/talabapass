"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Ko'p qadamli forma (qadamlar URL emas, holat): har bir yangi qadam brauzer tarixiga yoziladi, shunda telefondagi
 * "orqaga" (va brauzer tugmasi) formadan chiqib ketmaydi, oldingi qadamga qaytaradi.
 *
 * - `depth` — qadam chuqurligi (0 — birinchi qadam).
 * - `onPop` — brauzer "orqaga" bosilganda holatni bir qadam orqaga qaytaradi.
 * - Qaytariladigan funksiya (← tugmasi): `depth > 0` bo'lsa tarixdan orqaga (holat `onPop` orqali o'zgaradi),
 *   aks holda `leaveTo` ga o'tadi (1-qadamda — bosh sahifa).
 * Holat tarixsiz o'zgarsa (masalan, xato tufayli 1-qadamga qaytish) ortiqcha yozuvlar jimgina olib tashlanadi.
 */
export function useStepHistory(depth: number, onPop: () => void, leaveTo: string = "/"): () => void {
  const router = useRouter();
  const pushed = useRef(0);
  const ignorePop = useRef(false);
  const handler = useRef(onPop);

  useEffect(() => {
    handler.current = onPop;
  });

  useEffect(() => {
    while (pushed.current < depth) {
      window.history.pushState({ ...window.history.state, tpStep: pushed.current + 1 }, "");
      pushed.current += 1;
    }
    if (pushed.current > depth) {
      const extra = pushed.current - depth;
      pushed.current = depth;
      ignorePop.current = true;
      window.history.go(-extra);
    }
  }, [depth]);

  useEffect(() => {
    const onPopState = () => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      if (pushed.current > 0) {
        pushed.current -= 1;
        handler.current();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return useCallback(() => {
    if (pushed.current > 0) window.history.back();
    else router.push(leaveTo);
  }, [router, leaveTo]);
}
