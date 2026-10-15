"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

const EVERY_MS = 30_000;

/** "Jonli" bloklar: sahifa ochiq turganda har 30 soniyada (yoki `everyMs`) server ma'lumotini yangilaydi. */
export function LiveRefresh({ everyMs = EVERY_MS }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
