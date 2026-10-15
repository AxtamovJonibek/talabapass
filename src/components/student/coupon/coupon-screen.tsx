"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link, useRouter } from "@/i18n/navigation";
import { cancelCouponAction, couponStateAction } from "@/server/actions/coupons";
import type { CouponView } from "@/server/coupons/coupons";
import { CouponTicket } from "./coupon-ticket";
import { formatTimer, useCouponToken } from "./use-coupon-token";

const TTL_MS = 10 * 60_000;
const POLL_MS = 4000;

/**
 * Kassir tasdiqlaganini kuzatish: internet bo'lsa har 4 soniyada so'raydi; sotilsa — chekka (Tarix).
 * Internet yo'q bo'lsa jim — QR baribir qurilmada yangilanib turadi.
 */
export function useRedeemWatch(couponId: string, enabled: boolean, onRedeemed: (redemptionId?: string) => void) {
  // Taymer har soniya qayta chizadi — kuzatuv qayta boshlanmasligi uchun chaqiriladigan funksiya ref'da
  const callback = useRef(onRedeemed);
  useEffect(() => {
    callback.current = onRedeemed;
  });
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(async () => {
      if (!navigator.onLine) return;
      const state = await couponStateAction(couponId).catch(() => null);
      if (state?.status === "REDEEMED") callback.current(state.redemptionId);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [couponId, enabled]);
}

/** T6 — kupon QR ekrani (qora fon). */
export function CouponScreen({ coupon, renderedAt, backHref }: { coupon: CouponView; renderedAt: number; backHref: string }) {
  const t = useTranslations("coupon");
  const router = useRouter();
  const token = useCouponToken(coupon, renderedAt);
  const [cancelling, startCancel] = useTransition();
  const [cancelled, setCancelled] = useState(false);

  useRedeemWatch(coupon.id, !token.expired && !cancelled, (redemptionId) => router.replace(redemptionId ? `/tarix?chek=${redemptionId}` : "/tarix"));

  const cancel = () =>
    startCancel(async () => {
      await cancelCouponAction(coupon.id);
      setCancelled(true);
      router.replace(backHref);
    });

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-paper">
      <div className="flex items-center justify-between px-4 pt-[54px]">
        <Link href={backHref} aria-label={t("close")} className="flex size-11 items-center justify-center rounded-full bg-ink-3 text-paper">
          <Icon name="close" size={20} />
        </Link>
        <div className="flex items-center gap-1.5 text-12 text-fog-2">
          <Icon name="sun" size={16} />
          {t("brightness")}
        </div>
        <div className="w-11" />
      </div>

      {token.expired ? (
        <div className="mx-5 mt-[18px] flex flex-col gap-3 rounded-22 bg-ink-2 p-5">
          <b className="text-18">{t("expiredTitle")}</b>
          <p className="m-0 text-14 leading-[1.45] text-fog-0">{t("expiredText")}</p>
          <ButtonLink href={backHref} variant="blue" size="md">
            {t("backToDeal")}
          </ButtonLink>
        </div>
      ) : (
        <>
          <div className="mx-5 mt-[18px]">
            <CouponTicket coupon={coupon} qr={token.qr} totp={token.totp} />
          </div>
          <div className="mx-5 mt-[18px] flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <div className="text-13 text-fog-2">{t("validFor")}</div>
              <div className="font-mono text-30 font-semibold text-white" data-testid="coupon-timer">
                {formatTimer(token.msLeft)}
              </div>
            </div>
            <div className="h-1.5 w-[150px] overflow-hidden rounded-3 bg-ink-4">
              <div className="h-1.5 bg-orange" style={{ width: `${Math.round((token.msLeft / TTL_MS) * 100)}%` }} />
            </div>
          </div>
          <p className="mx-5 mt-4 mb-0 text-14 leading-[1.45] text-fog-0">
            {t.rich("hint", { link: (chunks) => <Link href="/tarix" className="font-bold text-white underline">{chunks}</Link> })}
          </p>
        </>
      )}

      <div className="mt-auto px-5 pt-4 pb-[34px]">
        {!token.expired ? (
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="h-[50px] w-full rounded-14 border-hair border-ink-7 bg-transparent font-sans text-15 font-semibold text-paper disabled:opacity-50"
          >
            {t("cancel")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
