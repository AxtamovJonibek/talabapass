"use client";

import { useEffect, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatPhone, formatSom, MINUS } from "@/lib/format";
import { formatMinute, toTashkent } from "@/lib/time";
import { cancelOrderAction, payOrderAction } from "@/server/actions/preorder";
import type { StudentOrderRow, StudentOrderView } from "@/server/preorder/views";
import type { OrderStatus } from "@/lib/preorder";
import { QrImage } from "../coupon/coupon-ticket";
import { useCouponToken } from "../coupon/use-coupon-token";
import { StudentBottomNav, StudentWebNav } from "../app-chrome";

const clock = (iso: string) => formatMinute(toTashkent(new Date(iso)).minute);

/** Holat belgisi: faol — ko'k, tayyor — yashil, yopilgan — kulrang/qizil. */
const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-warn-bg text-warn",
  PAID: "bg-info-bg text-blue",
  CONFIRMED: "bg-info-bg text-blue",
  READY: "bg-green-bg text-green",
  COMPLETED: "bg-surface text-ink",
  REJECTED: "bg-danger-bg text-danger",
  CANCELLED: "bg-surface text-muted",
  NO_SHOW: "bg-danger-bg text-danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("orderStatus");
  return (
    <span className={cn("shrink-0 rounded-8 px-2 py-1 font-mono text-11 font-bold tracking-[0.06em] uppercase", STATUS_TONE[status])} data-testid="order-status">
      {t(status)}
    </span>
  );
}

function useWhen() {
  const t = useTranslations();
  return (startIso: string, endIso: string) => {
    const start = toTashkent(new Date(startIso));
    const today = toTashkent(new Date()).date.getTime();
    const day =
      start.date.getTime() === today
        ? t("booking.today")
        : start.date.getTime() === today + 86_400_000
          ? t("booking.tomorrow")
          : `${start.date.getUTCDate()}-${t(`month.name.${start.date.getUTCMonth() + 1}` as "month.name.1")}`;
    return `${day}, ${clock(startIso)}–${clock(endIso)}`;
  };
}

/**
 * Sahifa qobig'i. Kontent bir marta chiziladi (buyurtma sahifasi o'zini yangilaydi va QR hisoblaydi — ikki nusxa
 * bo'lmasin): 700px dan torda pastki navigatsiya, kengroqda WT4 sarlavhasi.
 */
export function OrdersFrame({ title, back, coupons, children }: { title: string; back?: { href: string; label: string }; coupons: number; children: ReactNode }) {
  return (
    <div className="@container flex min-h-dvh flex-col bg-paper text-ink">
      <div className="hidden @min-[700px]:block">
        <StudentWebNav active="profile" />
      </div>
      <main className="mx-auto box-border w-full max-w-[720px] flex-1 px-5 pt-[58px] pb-6 @min-[700px]:px-[clamp(16px,3cqw,40px)] @min-[700px]:pt-7 @min-[700px]:pb-[60px]">
        {back ? (
          <Link href={back.href} className="tp-link flex h-11 items-center gap-1.5 text-14 font-bold text-ink no-underline">
            <Icon name="chevronLeft" size={16} strokeWidth={2.4} />
            {back.label}
          </Link>
        ) : null}
        <h1 className="m-0 mt-2 mb-4 text-30 leading-none font-black tracking-[-0.03em] font-stretch-112%">{title}</h1>
        {children}
      </main>
      {/* sticky, fixed emas: @container (layout containment) fixed'ni ekranga emas, konteynerga bog'laydi */}
      <div className="sticky bottom-0 z-20 @min-[700px]:hidden">
        <StudentBottomNav active="profile" coupons={coupons} />
      </div>
    </div>
  );
}

/** "Mening buyurtmalarim" ro'yxati */
export function OrderList({ orders }: { orders: StudentOrderRow[] }) {
  const t = useTranslations("orders");
  const when = useWhen();
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-16 bg-white px-6 py-10 text-center">
        <Icon name="clock" size={32} strokeWidth={1.6} className="text-placeholder" />
        <b className="text-17">{t("empty")}</b>
        <p className="m-0 text-14 text-muted">{t("emptyHint")}</p>
        <ButtonLink href="/chegirmalar" variant="outline-soft" size="sm">
          {t("browse")}
        </ButtonLink>
      </div>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/buyurtmalar/${o.id}`} className="tp-row flex items-center gap-3 rounded-16 bg-white px-4 py-3.5 text-ink no-underline">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-13 text-muted">{o.businessName}</span>
              <span className="truncate text-16 font-bold">
                {o.title} × {o.quantity}
              </span>
              <span className="font-mono text-13">{when(o.slotStart, o.slotEnd)}</span>
            </span>
            <StatusBadge status={o.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "font-bold")}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/** Tasdiqlangan/tayyor buyurtma QR'i — kupon kabi qurilmada hisoblanadi (internetsiz ham yangilanadi). */
function OrderQr({ order }: { order: StudentOrderView & { secret: string } }) {
  const t = useTranslations("orders");
  const token = useCouponToken({ code: order.code, secret: order.secret, expiresAt: new Date(Date.parse(order.slotEnd) + 60 * 60_000).toISOString() }, order.renderedAt);
  return (
    <div className="enter-rise flex flex-col items-center gap-3 rounded-22 bg-white px-5 py-5 text-center">
      <QrImage qr={token.qr} cell={6} label={t("code")} className="size-[220px]" />
      <div className="font-mono text-15 font-semibold tracking-[0.08em]" data-testid="order-code">
        {order.code}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-13 text-muted">{t("totp")}</span>
        <span className="font-mono text-22 font-semibold tracking-[0.12em]" data-testid="order-totp">
          {token.totp ?? "······"}
        </span>
      </div>
      <p className="m-0 text-13 text-muted">
        {t("qrHint")} · {t("refreshIn", { s: token.refreshIn })}
      </p>
    </div>
  );
}

/** Buyurtma tafsiloti: holat, QR, vaqt chizig'i, summalar, bekor qilish (qaytadigan summa oldindan). 5 s da yangilanadi. */
export function OrderDetail({ order }: { order: StudentOrderView }) {
  const t = useTranslations("orders");
  const tb = useTranslations("booking");
  const ts = useTranslations("orderStatus");
  const tc = useTranslations("common");
  const router = useRouter();
  const when = useWhen();
  const [pending, start] = useTransition();
  const [paying, startPaying] = useTransition();

  // Holat o'zgarishini kutamiz (biznes qabul qildi, tayyor, berildi)
  const open = order.status === "PENDING_PAYMENT" || order.status === "PAID" || order.status === "CONFIRMED" || order.status === "READY";
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [open, router]);

  const cancel = () => {
    if (!order.cancel) return;
    if (!window.confirm(t("cancelConfirm", { refund: formatSom(order.cancel.refund) }))) return;
    start(async () => {
      const result = await cancelOrderAction(order.id);
      toast(result.ok ? t("cancelled") : t("cancelFailed"), result.ok ? "ok" : "info");
      router.refresh();
    });
  };
  const pay = () =>
    startPaying(async () => {
      const { checkoutUrl } = await payOrderAction(order.id);
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else router.refresh();
    });

  const freeUntil = clock(order.freeCancelUntil);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-16 bg-white px-4 py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-18 font-extrabold">
            {order.title} × {order.quantity}
          </span>
          <span className="font-mono text-14">{when(order.slotStart, order.slotEnd)}</span>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <p className="m-0 px-1 text-14 font-semibold">
        {t(`statusNote.${order.status}`)}
        {order.rejectReason ? ` ${t("rejectReason", { reason: order.rejectReason })}` : null}
      </p>

      {order.secret ? <OrderQr order={order as StudentOrderView & { secret: string }} /> : null}

      {order.status === "PENDING_PAYMENT" && order.prepayAmount > 0 ? (
        <div className="flex flex-col gap-2 rounded-16 bg-warn-bg px-4 py-3.5">
          <span className="text-14 text-warn">{t("payHint")}</span>
          <Button size="md" block loading={paying} onClick={pay}>
            {t("pay")} · {formatSom(order.prepayAmount)} {tc("currency")}
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="order-timeline" className="rounded-16 bg-white px-4 py-3.5">
        <h2 id="order-timeline" className="m-0 mb-2 text-15 font-extrabold">
          {t("timeline")}
        </h2>
        <ol className="m-0 flex list-none flex-col p-0" data-testid="order-timeline">
          {order.events.map((e, i) => (
            <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
              <span className="relative flex w-3 justify-center">
                <span className={cn("mt-1 size-3 rounded-full", i === order.events.length - 1 ? "bg-ink" : "bg-line")} />
                {i < order.events.length - 1 ? <span className="absolute top-4 bottom-[-4px] w-0.5 bg-line-soft" /> : null}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="flex justify-between gap-3 text-14 font-bold">
                  {ts(e.to)}
                  <span className="font-mono text-12 font-normal text-muted">{clock(e.at)}</span>
                </span>
                {e.reason && e.reason in REASONS ? <span className="text-13 text-muted">{t(`reasons.${e.reason as keyof typeof REASONS}`)}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2 rounded-16 bg-white px-4 py-3.5 text-14">
        <Row label={t("mode")}>{tb(`modes.${order.mode}`)}</Row>
        <Row label={t("address")}>{order.address}</Row>
        <Row label={t("phone")}>
          <span className="font-mono">{formatPhone(order.phone)}</span>
        </Row>
        {order.note ? <Row label={t("note")}>{order.note}</Row> : null}
        <div className="border-t-hair-dashed my-1" />
        <Row label={t("original")}>
          <s className="font-mono text-muted">{formatSom(order.totalOriginal)}</s>
        </Row>
        <Row label={t("discount")}>
          <span className="font-mono text-rust">
            {MINUS}
            {formatSom(order.totalOriginal - order.totalFinal)}
          </span>
        </Row>
        <Row label={t("total")} strong>
          <span className="font-mono">{formatSom(order.totalFinal)}</span>
        </Row>
        {order.prepayAmount > 0 ? (
          <Row label={t("prepaid")}>
            <span className="font-mono">{formatSom(order.prepayAmount)}</span>
          </Row>
        ) : null}
        {order.totalFinal > order.prepayAmount ? (
          <Row label={t("dueAtCounter")}>
            <span className="font-mono">{formatSom(order.totalFinal - order.prepayAmount)}</span>
          </Row>
        ) : null}
      </section>

      {order.cancel ? (
        <section className="flex flex-col gap-2 rounded-16 border-hair border-line px-4 py-3.5">
          {order.prepayAmount > 0 && order.status !== "PENDING_PAYMENT" ? (
            <>
              <b className="text-14" data-testid="cancel-refund">
                {t("cancelRefund", { refund: formatSom(order.cancel.refund) })}
              </b>
              <span className="text-13 text-muted">{order.cancel.keep > 0 ? t("cancelKeep", { keep: formatSom(order.cancel.keep), time: freeUntil }) : t("cancelFreeUntil", { time: freeUntil })}</span>
            </>
          ) : null}
          <Button variant="danger-outline" size="md" block loading={pending} onClick={cancel}>
            {t("cancel")}
          </Button>
        </section>
      ) : null}
      {/* Holat nomlari ekran o'qigich uchun ham — ortiqcha emas */}
      <span className="sr-only" aria-live="polite">
        {ts(order.status)}
      </span>
    </div>
  );
}

const REASONS = { unpaid: 1, noResponse: 1, paymentFailed: 1, student: 1, auto: 1, noShow: 1 } as const;

/** Biznes paneli ham ishlatadi: "Bugun, 14:00–14:30" */
export const useOrderWhen = useWhen;
