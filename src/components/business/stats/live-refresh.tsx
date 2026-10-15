"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

const EVERY_MS = 30_000;

/** "Jonli" bloklar: sahifa ochiq turganda har 30 soniyada server ma'lumotini yangilaydi. */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
