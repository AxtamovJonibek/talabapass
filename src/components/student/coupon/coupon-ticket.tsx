"use client";

import { useTranslations } from "next-intl";
import { DealBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatSom } from "@/lib/format";
import type { CouponView } from "@/server/coupons/coupons";
import type { QrMatrix } from "./use-coupon-token";

/** QR matritsasi — SVG (piksel aniq, har qanday o'lchamda keskin). Oq hoshiya bilan. */
export function QrImage({ qr, cell, label, className }: { qr: QrMatrix | null; cell: number; label: string; className?: string }) {
  const size = qr?.size ?? 29;
  const px = size * cell;
  return (
    <div role="img" aria-label={label} className={cn("bg-white p-1.5", className)}>
      <svg width={px} height={px} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
        {qr
          ? qr.cells.map((on, i) => (on ? <rect key={i} x={i % size} y={Math.floor(i / size)} width="1" height="1" className="fill-ink" /> : null))
          : null}
      </svg>
    </div>
  );
}

/** Qo'lda kiritish uchun 6 raqamli kod: "482 913" (dizaynda chizilmagan — kupon kodi ostida). */
export const groupCode = (code: string | null) => (code ? `${code.slice(0, 3)} ${code.slice(3)}` : "··· ···");

const COURSE = (course: string, t: ReturnType<typeof useTranslations>) => (course === "MASTER" ? t("master") : t("course", { n: course.slice(1) }));

/** T6: oq "chipta" — chegirma, QR, kupon kodi, 6 raqamli kod, talaba. Ota fon: ink. */
export function CouponTicket({ coupon, qr, totp }: { coupon: CouponView; qr: QrMatrix | null; totp: string | null }) {
  const t = useTranslations("coupon");
  const common = useTranslations("common");
  return (
    <div className="relative rounded-22 bg-white text-ink">
      <div className="flex items-start justify-between gap-3 px-5 pt-[18px] pb-4">
        <div className="flex flex-col gap-[3px]">
          <div className="text-12 text-muted">{coupon.store}</div>
          <div className="text-18 leading-[1.15] font-extrabold">{coupon.title}</div>
          <div className="mt-0.5 text-14">
            {coupon.price ? (
              <>
                <b>
                  {formatSom(coupon.price.now)} {common("currency")}
                </b>{" "}
                {coupon.price.old ? <s className="font-mono text-12 text-muted-2">{formatSom(coupon.price.old)}</s> : null}
              </>
            ) : (
              <b>{coupon.note ?? coupon.badge}</b>
            )}
          </div>
        </div>
        <DealBadge size="ticket">{coupon.badge}</DealBadge>
      </div>
      <div className="mx-[18px] border-0 border-t-2 border-dashed border-dash" />
      <div className="absolute top-[107px] -left-[11px] size-[22px] rounded-full bg-ink" />
      <div className="absolute top-[107px] -right-[11px] size-[22px] rounded-full bg-ink" />

      <div className="flex flex-col items-center gap-3 pt-[22px] pb-2.5">
        <QrImage qr={qr} cell={7} label={t("qrLabel")} className="enter-focus [animation-delay:200ms]" />
        <div className="font-mono text-17 font-semibold tracking-[0.12em]" data-testid="coupon-code">
          {coupon.code}
        </div>
        <div className="flex items-center gap-2 text-12 text-muted">
          {t("manualCode")}
          <b className="font-mono text-15 tracking-[0.08em] text-ink" data-testid="coupon-totp">
            {groupCode(totp)}
          </b>
        </div>
      </div>

      <div className="mx-4 mt-1.5 mb-4 flex items-center gap-2.5 rounded-14 bg-paper px-3 py-2.5">
        <div className="flex size-10 items-center justify-center rounded-full bg-blue text-14 font-extrabold text-white">{coupon.student.initials}</div>
        <div className="flex flex-1 flex-col gap-px">
          <div className="text-14 font-bold">{coupon.student.name}</div>
          <div className="text-12 text-muted">
            {coupon.student.university} · {COURSE(coupon.student.course, t)}
          </div>
        </div>
        <div className="flex items-center gap-1 text-12 font-bold text-green">
          <Icon name="check" size={14} strokeWidth={3} />
          {t("student")}
        </div>
      </div>
    </div>
  );
}

/** WT3 QR paneli: qora quti ichida ixcham chipta, taymer va bekor qilish. */
export function CouponPanel({
  coupon,
  qr,
  totp,
  timer,
  onCancel,
  cancelling,
}: {
  coupon: CouponView;
  qr: QrMatrix | null;
  totp: string | null;
  timer: string;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const t = useTranslations("coupon");
  return (
    // Kupon olingach yon panel shu joyda taklif kartasidan QR'ga almashadi — pastdan ko'tariladi
    <div className="enter-rise rounded-22 bg-ink p-[18px]">
      <div className="relative rounded-16 bg-white text-ink">
        <div className="flex items-center justify-between px-[18px] py-4">
          <div>
            <div className="text-12 text-muted">{coupon.store}</div>
            <b>{[coupon.title, coupon.price ? formatSom(coupon.price.now) : null].filter(Boolean).join(" · ")}</b>
          </div>
          <DealBadge size="ticket-sm">{coupon.badge}</DealBadge>
        </div>
        <div className="mx-4 border-0 border-t-2 border-dashed border-dash" />
        <div className="absolute top-[66px] -left-[11px] size-[22px] rounded-full bg-ink" />
        <div className="absolute top-[66px] -right-[11px] size-[22px] rounded-full bg-ink" />
        <div className="flex flex-col items-center gap-2.5 p-[18px]">
          <QrImage qr={qr} cell={7} label={t("qrLabel")} className="enter-focus [animation-delay:200ms]" />
          <div className="font-mono text-17 font-semibold tracking-[0.12em]">{coupon.code}</div>
          <div className="flex items-center gap-2 text-12 text-muted">
            {t("manualCode")}
            <b className="font-mono text-15 tracking-[0.08em] text-ink">{groupCode(totp)}</b>
          </div>
        </div>
      </div>
      <div className="mt-3.5 flex items-center justify-between text-paper">
        <span className="text-13 text-fog-2">{t("validFor")}</span>
        <b className="font-mono text-26">{timer}</b>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelling} aria-busy={cancelling}
        className="mt-3 h-[46px] w-full rounded-12 border-hair border-ink-7 bg-transparent font-sans text-14 font-semibold text-paper transition-[scale] duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
      >
        {t("cancel")}
      </button>
    </div>
  );
}
