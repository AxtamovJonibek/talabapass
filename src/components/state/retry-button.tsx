"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Tarmoq bormi? Service worker aralashmaydigan (navigatsiya emas) so'rov — keshdan javob bermaydi. */
async function reachable() {
  try {
    const res = await fetch("/manifest.webmanifest", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * `onRetry` berilsa (xato sahifasi) — shuni chaqiradi. Berilmasa (oflayn sahifa) avval tarmoqni tekshiradi:
 * bor bo'lsa sahifani qayta yuklaydi, yo'q bo'lsa "hali ulanish yo'q" deydi; tarmoq qaytganda o'zi ham yangilaydi.
 */
export function RetryButton({ label, onRetry }: { label: string; onRetry?: () => void }) {
  const t = useTranslations("state");
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setFailed(false);
    const ok = await reachable();
    if (ok) {
      // /oflayn o'zi sahifa emas — asl manzil o'rniga ko'rsatilgan; qayta yuklash asl sahifani ochadi
      if (window.location.pathname.endsWith("/oflayn")) window.location.replace("/");
      else window.location.reload();
      return;
    }
    busy.current = false;
    setChecking(false);
    setFailed(true);
  }, []);

  useEffect(() => {
    if (onRetry) return;
    window.addEventListener("online", check);
    return () => window.removeEventListener("online", check);
  }, [onRetry, check]);

  return (
    <>
      <Button type="button" variant="blue" disabled={checking} aria-busy={checking} onClick={onRetry ?? check}>
        {label}
      </Button>
      {failed ? (
        <p role="status" data-testid="still-offline" className="m-0 text-center text-13 font-semibold text-danger">
          {t("stillOffline")}
        </p>
      ) : null}
    </>
  );
}
