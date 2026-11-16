"use client";

import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { localizedPath, type Locale } from "@/i18n/routing";

/** Tarmoq bormi? Service worker aralashmaydigan (navigatsiya emas) so'rov — keshdan javob bermaydi. */
async function reachable() {
  try {
    const res = await fetch("/site.webmanifest", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * `onRetry` berilsa (xato sahifasi) — shuni chaqiradi. Berilmasa (oflayn sahifa) avval tarmoqni tekshiradi:
 * bor bo'lsa sahifani qayta yuklaydi, yo'q bo'lsa "hali ulanish yo'q" deydi; tarmoq qaytganda o'zi ham yangilaydi.
 */
export function RetryButton({ label, onRetry, size, strong }: { label: string; onRetry?: () => void; size?: ComponentProps<typeof Button>["size"]; strong?: boolean }) {
  const t = useTranslations("state");
  const locale = useLocale() as Locale;
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
      if (window.location.pathname.endsWith("/oflayn")) window.location.replace(localizedPath("/", locale));
      else window.location.reload();
      return;
    }
    busy.current = false;
    setChecking(false);
    setFailed(true);
  }, [locale]);

  useEffect(() => {
    if (onRetry) return;
    window.addEventListener("online", check);
    return () => window.removeEventListener("online", check);
  }, [onRetry, check]);

  return (
    <>
      <Button type="button" variant="blue" size={size} strong={strong} block disabled={checking} aria-busy={checking} onClick={onRetry ?? check}>
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
