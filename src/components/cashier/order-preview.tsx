"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { formatPhone, formatSom } from "@/lib/format";
import { completeOrderAction } from "@/server/actions/preorder";
import type { OrderScanPreview } from "@/server/preorder/scan";

/**
 * Skanerda oldindan band qilingan buyurtma (B4 uslubida, dizaynda chizilmagan): nima, nechta, kim uchun, vaqt,
 * oldindan to'langan va kassada olinadigan summa. "Berildi" — BERILDI holati va to'lov yechiladi.
 */
export function OrderPreview({ order: o, at, onCancel, onDone }: { order: OrderScanPreview; at: string; onCancel: () => void; onDone: () => void }) {
  const t = useTranslations("scanner");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const complete = () =>
    start(async () => {
      setError(null);
      const result = await completeOrderAction(o.orderId, o.ticket);
      if (result.ok) onDone();
      else setError(t(`errors.${result.error}` as "errors.INVALID"));
    });

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex items-center gap-3 bg-green px-4 pt-[54px] pb-[18px] text-white">
        <button type="button" onClick={onCancel} aria-label={t("backToScan")} className="tp-lift flex size-11 items-center justify-center rounded-full border-0 bg-green-2 text-white">
          <Icon name="close" size={20} />
        </button>
        <div className="flex-1">
          <div className="text-18 font-extrabold">{t("order.valid")}</div>
          <div className="font-mono text-12 text-mint-3">
            {o.code} · {at}
          </div>
        </div>
        <Icon name="checkCircle" size={34} />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4" data-testid="order-preview">
        <div className="flex items-center gap-3 rounded-16 bg-white p-3.5">
          <div className="flex size-14 items-center justify-center rounded-14 bg-blue text-20 font-black text-white">{o.student.initials}</div>
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="text-17 font-extrabold">{o.student.name}</div>
            <a href={`tel:${o.student.phone}`} className="tp-link font-mono text-13 text-muted no-underline">
              {formatPhone(o.student.phone)}
            </a>
          </div>
        </div>

        <div className="rounded-16 bg-white px-4 py-3.5">
          <div className="text-12 text-muted">{t("order.mode." + o.mode as "order.mode.PICKUP")}</div>
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <div className="text-20 font-extrabold">{o.title}</div>
            <div className="font-mono text-28 font-semibold" data-testid="order-quantity">
              × {o.quantity}
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 font-mono text-14">
            <div className="flex justify-between">
              <span className="text-muted">{t("order.slot")}</span>
              <span>{o.slot}</span>
            </div>
            {o.note ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted">{t("order.note")}</span>
                <span className="text-right font-sans">{o.note}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted">{t("order.prepaid")}</span>
              <span>{formatSom(o.prepayAmount)}</span>
            </div>
            <div className="border-t-hair-dashed" />
            <div className="flex items-baseline justify-between">
              <span className="font-sans font-bold">{t("order.dueNow")}</span>
              <span className="text-26 font-semibold">{formatSom(o.dueNow)}</span>
            </div>
            {o.dueNow === 0 ? <div className="text-right font-sans text-13 font-semibold text-green">{t("order.nothingDue")}</div> : null}
          </div>
        </div>

        {error ? (
          <div role="alert" className="rounded-14 bg-danger-bg px-3.5 py-3 text-14 font-semibold text-danger">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-2 border-0 border-t border-solid border-line-soft px-4 pt-3 pb-[30px]">
        <button type="button" onClick={onCancel} className="tp-btn tp-paint h-14 rounded-14 border-hair border-line bg-white font-sans text-15 font-bold text-ink">
          {t("back")}
        </button>
        <button type="button" onClick={complete} disabled={pending} aria-busy={pending} className="tp-btn tp-stamp [--tp-bar:var(--color-ink)] h-14 rounded-14 border-0 bg-orange font-sans text-16 font-extrabold text-ink disabled:opacity-50">
          {t("order.complete")}
        </button>
      </div>
    </div>
  );
}

/** "Buyurtma berildi" — keyingi skanga. */
export function OrderDone({ onNext }: { onNext: () => void }) {
  const t = useTranslations("scanner");
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div className="enter-rise flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-green-bg text-green">
          <Icon name="check" size={32} strokeWidth={2.6} />
        </span>
        <div className="text-26 font-black tracking-[-0.02em] font-stretch-110%" data-testid="order-done">
          {t("order.done")}
        </div>
        <p className="m-0 text-14 text-muted">{t("order.doneHint")}</p>
      </div>
      <div className="px-4 pt-3 pb-[30px]">
        <button type="button" onClick={onNext} className="tp-btn tp-stamp [--tp-shadow:var(--color-orange)] h-14 w-full rounded-14 border-0 bg-ink font-sans text-16 font-extrabold text-white">
          {t("next")}
        </button>
      </div>
    </div>
  );
}
