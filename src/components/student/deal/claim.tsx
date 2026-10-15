"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";
import { cancelCouponAction, claimCouponAction } from "@/server/actions/coupons";
import type { ClaimError, CouponView } from "@/server/coupons/coupons";
import { CouponPanel } from "../coupon/coupon-ticket";
import { useRedeemWatch } from "../coupon/coupon-screen";
import { formatTimer, useCouponToken } from "../coupon/use-coupon-token";

export type ClaimState = {
  discountId: string;
  /** Hozir ochiq va bugungi qoldiq bor */
  available: boolean;
  /** Nega olib bo'lmaydi (tugma ostida) */
  unavailableText: string | null;
  /** Shu chegirmadagi faol kupon (bo'lsa — QR) */
  coupon: CouponView | null;
  renderedAt: number;
};

function useClaim(discountId: string) {
  const t = useTranslations("coupon");
  const [pending, start] = useTransition();
  const [error, setError] = useState<ClaimError | null>(null);
  const claim = (onCoupon: (coupon: CouponView) => void) =>
    start(async () => {
      setError(null);
      const result = await claimCouponAction(discountId);
      if (result.ok) onCoupon(result.coupon);
      else setError(result.error);
    });
  return { pending, claim, errorText: error ? t(`claimErrors.${error}`) : null };
}

/** T5 pastki CTA: kupon olinadi va QR ekraniga (T6) o'tiladi; faol kupon bo'lsa — darhol QR. */
export function PhoneClaim({ state }: { state: ClaimState }) {
  const t = useTranslations("dealPage");
  const router = useRouter();
  const { pending, claim, errorText } = useClaim(state.discountId);
  if (state.coupon) {
    return (
      <ButtonLink href={`/kuponlar/${state.coupon.id}`} size="cta" strong block>
        <Icon name="qr" size={22} />
        {t("showCoupon")}
      </ButtonLink>
    );
  }
  return (
    <>
      <Button size="cta" strong block disabled={!state.available || pending} onClick={() => claim((c) => router.push(`/kuponlar/${c.id}`))}>
        <Icon name="qr" size={22} />
        {t("claim")}
      </Button>
      {errorText || state.unavailableText ? <div className="text-center text-12 font-semibold text-danger">{errorText ?? state.unavailableText}</div> : null}
    </>
  );
}

/**
 * WT3 yon paneli: taklif kartasi yoki (kupon olingach) qora QR paneli — dizayndagi `offer` / `showQr` holatlari.
 * `top` — narx va holat, `terms` — shartlar matni (server tomonda tayyorlanadi).
 */
export function WebClaim({ state, top, terms }: { state: ClaimState; top: ReactNode; terms: ReactNode }) {
  const t = useTranslations("dealPage");
  const [coupon, setCoupon] = useState(state.coupon);
  const { pending, claim, errorText } = useClaim(state.discountId);
  if (coupon) return <WebCoupon coupon={coupon} renderedAt={state.renderedAt} onClosed={() => setCoupon(null)} />;
  return (
    <div className="flex flex-col gap-3.5 rounded-22 border-hair border-ink bg-white p-[22px]">
      {top}
      <Button size="cta-lg" strong block disabled={!state.available || pending} onClick={() => claim(setCoupon)}>
        <Icon name="qr" size={22} />
        {t("claim")}
      </Button>
      {errorText || state.unavailableText ? <div className="text-13 font-semibold text-danger">{errorText ?? state.unavailableText}</div> : null}
      {terms}
    </div>
  );
}

function WebCoupon({ coupon, renderedAt, onClosed }: { coupon: CouponView; renderedAt: number; onClosed: () => void }) {
  const router = useRouter();
  const token = useCouponToken(coupon, renderedAt);
  const [cancelling, start] = useTransition();
  useRedeemWatch(coupon.id, !token.expired, (redemptionId) => router.push(redemptionId ? `/tarix?chek=${redemptionId}` : "/tarix"));
  useEffect(() => {
    if (token.expired) onClosed();
  }, [token.expired, onClosed]);
  if (token.expired) return null;
  return (
    <CouponPanel
      coupon={coupon}
      qr={token.qr}
      totp={token.totp}
      timer={formatTimer(token.msLeft)}
      cancelling={cancelling}
      onCancel={() =>
        start(async () => {
          await cancelCouponAction(coupon.id);
          onClosed();
          router.refresh();
        })
      }
    />
  );
}
