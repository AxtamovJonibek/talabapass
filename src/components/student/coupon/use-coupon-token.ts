"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { fromBase64Url, qrToken, secondsLeftInWindow, totpCode, windowAt } from "@/lib/totp";

export type QrMatrix = { size: number; cells: boolean[] };

/**
 * Kupon QR'i va 6 raqamli kodi — qurilmaning o'zida, internetsiz (src/lib/totp). Har soniya taymer,
 * oyna almashganda (60 s) yangi token. Kupon muddati tugasa `expired`.
 */
export function useCouponToken(coupon: { code: string; secret: string; expiresAt: string }, initialNow: number) {
  // Birinchi chizish server vaqti bilan (gidratsiya mos kelsin), keyin qurilma soati
  const [now, setNow] = useState(initialNow);
  const [state, setState] = useState<{ slot: number; qr: QrMatrix; text: string; totp: string } | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const slot = windowAt(now);
  useEffect(() => {
    let cancelled = false;
    const secret = fromBase64Url(coupon.secret);
    Promise.all([qrToken(coupon.code, secret, slot), totpCode(secret, slot)]).then(([text, totp]) => {
      if (cancelled) return;
      const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
      setState({ slot, text, totp, qr: { size: modules.size, cells: Array.from(modules.data, (v) => v === 1) } });
    });
    return () => {
      cancelled = true;
    };
  }, [coupon.code, coupon.secret, slot]);

  const msLeft = Math.max(0, Date.parse(coupon.expiresAt) - now);
  return {
    qr: state?.qr ?? null,
    text: state?.text ?? null,
    totp: state?.totp ?? null,
    msLeft,
    expired: msLeft <= 0,
    /** QR almashguncha */
    refreshIn: secondsLeftInWindow(now),
  };
}

/** 600 000 → "10:00" */
export const formatTimer = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
