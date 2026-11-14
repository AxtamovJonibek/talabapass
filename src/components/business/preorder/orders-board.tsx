"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatPhone, formatSom } from "@/lib/format";
import type { OrderFilter } from "@/lib/preorder";
import { decideOrderAction } from "@/server/actions/preorder";
import type { BusinessOrderRow, BusinessOrders } from "@/server/preorder/views";
import {
  StatusBadge,
  useOrderWhen,
} from "@/components/student/orders/order-views";

const POLL_MS = 5000;
const SOUND_KEY = "tp:buyurtma-ovoz";
const FILTERS: OrderFilter[] = ["new", "preparing", "ready", "done"];

async function fetchOrders(
  filter: OrderFilter,
): Promise<BusinessOrders | null> {
  try {
    const response = await fetch(`/api/biznes/buyurtmalar?holat=${filter}`, {
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as BusinessOrders) : null;
  } catch {
    return null;
  }
}

/** Qisqa ikki tonli signal (fayl kerak emas). Brauzer ovozni faqat foydalanuvchi bosgandan keyin ruxsat beradi. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(
        0.25,
        ctx.currentTime + i * 0.18 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + i * 0.18 + 0.16,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // ovozsiz qurilma
  }
}

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Biznes → "Buyurtmalar": jonli ro'yxat (5 soniyada so'raladi), yangi buyurtmada ovozli signal va belgi (tab va
 * sarlavha), filtrlar, Qabul qilish / Rad etish (sabab bilan) / Tayyor, bugungi hisobot. Dizaynda chizilmagan.
 */
export function OrdersBoard({
  initial,
  initialFilter,
}: {
  initial: BusinessOrders;
  initialFilter: OrderFilter;
}) {
  const t = useTranslations("businessOrders");
  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [data, setData] = useState(initial);
  const [sound, setSound] = useState(true);
  const seen = useRef<Set<string> | null>(null);
  const filterRef = useRef(filter);
  const soundRef = useRef(sound);
  useEffect(() => {
    filterRef.current = filter;
    soundRef.current = sound;
  });

  useEffect(() => {
    // localStorage faqat klientda: birinchi chizishdan keyin
    const id = setTimeout(() => setSound(readSound()), 0);
    return () => clearTimeout(id);
  }, []);

  // Bitta so'rov: tanlangan filtr ro'yxati + sanoqlar + javob kutayotganlar id'lari. Hech qachon ko'rilmagan
  // yangi id — signal va toast (birinchi yuklashda emas).
  const refresh = useCallback(
    async (which: OrderFilter = filterRef.current) => {
      const next = await fetchOrders(which);
      if (!next || which !== filterRef.current) return;
      const ids = new Set(next.newIds);
      if (seen.current && next.newIds.some((id) => !seen.current!.has(id))) {
        toast(t("newOrder"), "info");
        if (soundRef.current) beep();
      }
      seen.current = ids;
      setData(next);
    },
    [t],
  );

  useEffect(() => {
    seen.current = new Set(initial.newIds);
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [initial.newIds, refresh]);

  // Sarlavhadagi belgi: (2) Buyurtmalar
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title =
      data.counts.new > 0 ? `(${data.counts.new}) ${base}` : base;
  }, [data.counts.new]);

  const changeFilter = (next: OrderFilter) => {
    setFilter(next);
    filterRef.current = next;
    void refresh(next);
  };

  const toggleSound = (on: boolean) => {
    setSound(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    } catch {
      // saqlab bo'lmasa — shu sahifada ishlaydi
    }
    if (on) beep();
  };

  const r = data.report;
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label={t("report.title")}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-2"
        data-testid="orders-report"
      >
        {(
          [
            ["orders", r.orders],
            ["revenue", `${formatSom(r.revenue)}`],
            ["cancelled", r.cancelled],
            ["noShow", r.noShow],
          ] as const
        ).map(([key, value]) => (
          <div
            key={key}
            className="flex flex-col gap-1 rounded-16 bg-white px-4 py-3"
          >
            <span className="text-12 text-muted">
              {t("report.title")} · {t(`report.${key}`)}
            </span>
            <span className="font-mono text-22 font-semibold">{value}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tor ekranda filtrlar gorizontal suriladi */}
        <div className="-mx-4 max-w-[calc(100%+32px)] overflow-x-auto px-4 @min-[700px]:mx-0 @min-[700px]:max-w-full @min-[700px]:px-0">
          <Segmented
            size="md"
            label={t("title")}
            value={filter}
            onChange={changeFilter}
            options={FILTERS.map((f) => ({
              value: f,
              label: (
                <>
                  {t(`filters.${f}`)}
                  {f !== "done" && data.counts[f] > 0 ? (
                    <span
                      className={cn(
                        "min-w-5 rounded-10 px-1.5 font-mono text-11 leading-5",
                        f === "new"
                          ? "bg-orange text-ink"
                          : "bg-ink text-white",
                      )}
                      data-testid={`count-${f}`}
                    >
                      {data.counts[f]}
                    </span>
                  ) : null}
                </>
              ),
            }))}
            className="w-max whitespace-nowrap"
          />
        </div>
        <label className="flex items-center gap-2 text-13 font-semibold text-muted">
          <Switch
            small
            checked={sound}
            onChange={toggleSound}
            label={t("sound")}
          />
          {t("sound")}
        </label>
      </div>
      <p className="m-0 -mt-2 font-mono text-11 tracking-[0.08em] text-muted uppercase">
        {t("live")}
      </p>

      {data.orders.length === 0 ? (
        <div className="rounded-16 bg-white px-5 py-10 text-center text-14 text-muted">
          {t(`empty.${filter}`)}
        </div>
      ) : (
        <ul
          className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3 p-0"
          data-testid="orders-list"
        >
          {data.orders.map((o) => (
            <OrderCard
              key={`${filter}:${o.id}`}
              order={o}
              now={data.now}
              onChanged={() => void refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({
  order: o,
  now,
  onChanged,
}: {
  order: BusinessOrderRow;
  now: number;
  onChanged: () => void;
}) {
  const t = useTranslations("businessOrders");
  const tb = useTranslations("booking");
  const when = useOrderWhen();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decide = (decision: "accept" | "reject" | "ready") =>
    start(async () => {
      setError(null);
      if (decision === "reject" && !reason.trim())
        return setError(t("reasonRequired"));
      const result = await decideOrderAction(
        o.id,
        decision,
        decision === "reject" ? reason : undefined,
      );
      if (!result.ok)
        return setError(
          result.error === "reason" ? t("reasonRequired") : t("failed"),
        );
      setRejecting(false);
      onChanged();
    });

  const minutesLeft = o.confirmBy
    ? Math.max(0, Math.ceil((Date.parse(o.confirmBy) - now) / 60_000))
    : null;

  return (
    <li
      className="flex flex-col gap-3 rounded-18 bg-white p-4"
      data-testid="order-card"
      data-code={o.code}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-14 font-semibold">
            {when(o.slotStart, o.slotEnd, o.kind)}
          </span>
          <span className="text-18 font-extrabold">
            {o.title} × {o.quantity}
          </span>
          <span className="text-13 text-muted">
            {o.mode ? tb(`modes.${o.mode}`) : tb(`kinds.${o.kind}.short`)} · {o.student} ·{" "}
            <a
              href={`tel:${o.phone}`}
              className="tp-link font-mono text-muted no-underline"
            >
              {formatPhone(o.phone)}
            </a>
          </span>
        </div>
        <StatusBadge status={o.status} />
      </div>
      {o.note ? (
        <p className="m-0 rounded-12 bg-surface px-3 py-2 text-14">{o.note}</p>
      ) : null}
      <div className="flex flex-wrap gap-x-3 font-mono text-13">
        {o.prepay === "NONE" ? (
          <span>{t("noPrepay")}</span>
        ) : (
          <span className="text-green">
            {t("prepaid", { amount: formatSom(o.prepayAmount) })}
          </span>
        )}
        {o.totalFinal > o.prepayAmount ? (
          <span>
            {t("dueAtCounter", {
              amount: formatSom(o.totalFinal - o.prepayAmount),
            })}
          </span>
        ) : null}
      </div>
      {o.status === "PAID" && minutesLeft !== null ? (
        <span className="text-13 font-bold text-warn">
          {t("respondIn", { min: minutesLeft })}
        </span>
      ) : null}
      {o.rejectReason ? (
        <span className="text-13 text-muted">{o.rejectReason}</span>
      ) : null}

      {rejecting ? (
        <div className="flex flex-col gap-2">
          <Field label={t("rejectReason")} htmlFor={`reject-${o.id}`}>
            <Textarea
              id={`reject-${o.id}`}
              rows={2}
              maxLength={150}
              placeholder={t("rejectPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline-soft"
              size="sm"
              onClick={() => setRejecting(false)}
            >
              {t("cancelReject")}
            </Button>
            <Button
              variant="danger-outline"
              size="sm"
              loading={pending}
              onClick={() => decide("reject")}
            >
              {t("rejectSend")}
            </Button>
          </div>
        </div>
      ) : o.status === "PAID" ? (
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button
            variant="outline-soft"
            size="sm"
            onClick={() => setRejecting(true)}
          >
            {t("reject")}
          </Button>
          <Button
            variant="orange"
            size="sm"
            loading={pending}
            onClick={() => decide("accept")}
          >
            {t("accept")}
          </Button>
        </div>
      ) : o.status === "CONFIRMED" ? (
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button
            variant="outline-soft"
            size="sm"
            onClick={() => setRejecting(true)}
          >
            {t("reject")}
          </Button>
          <Button
            variant="ink"
            size="sm"
            loading={pending}
            onClick={() => decide("ready")}
          >
            {t("ready")}
          </Button>
        </div>
      ) : null}
      {error ? (
        <span role="alert" className="text-13 font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </li>
  );
}

/** Sarlavhadagi "Sozlamalar" havolasi */
export function SettingsLink() {
  const t = useTranslations("businessOrders");
  return (
    <ButtonLink href="/biznes/sozlamalar" variant="outline-soft" size="sm">
      {t("settings")}
    </ButtonLink>
  );
}
