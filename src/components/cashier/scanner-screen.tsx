"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import jsQR from "jsqr";
import { PrintReceipt } from "@/components/receipt/receipt-view";
import { DealBadge } from "@/components/ui/badge";
import { ToggleSquare } from "@/components/ui/chip";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatSom, MINUS, priceAfterPercent } from "@/lib/format";
import { parseAmount } from "@/lib/discount";
import { formatMinute, toTashkent } from "@/lib/time";
import { parseQr } from "@/lib/totp";
import { confirmSaleAction, scanAction } from "@/server/actions/coupons";
import type { ScanPreview } from "@/server/coupons/scan";
import type { ReceiptData } from "@/server/coupons/receipts";

type Stage = { kind: "scan" } | { kind: "manual" } | { kind: "preview"; preview: ScanPreview; at: string } | { kind: "done"; receipt: ReceiptData };
type ScanError = { key: string; attemptsLeft?: number };

const PAYMENTS = ["CASH", "CARD", "QR"] as const;
const SCAN_EVERY_MS = 180;

/** BarcodeDetector (Chrome/Android) bo'lsa — u, aks holda jsQR (iOS Safari va boshqalar). */
type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
function nativeDetector(): Detector | null {
  const Ctor = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  try {
    return Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

/**
 * Kamera: orqa kamera, kadrdan QR o'qiladi; QR formati to'g'ri bo'lsa `onCode` (bitta matn qayta-qayta yuborilmaydi).
 * `paused` — B4 ochiq yoki so'rov ketayotganda.
 */
function useQrCamera(onCode: (text: string) => void, paused: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const last = useRef<{ text: string; at: number } | null>(null);
  const callback = useRef(onCode);
  const [status, setStatus] = useState<"starting" | "live" | "denied" | "unsupported">("starting");
  const [torch, setTorch] = useState<boolean | null>(null);

  useEffect(() => {
    callback.current = onCode;
  });

  useEffect(() => {
    if (!window.isSecureContext || typeof navigator.mediaDevices?.getUserMedia !== "function") {
      void Promise.resolve().then(() => setStatus("unsupported"));
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        track.current = s.getVideoTracks()[0] ?? null;
        const caps = track.current?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorch(caps?.torch ? false : null);
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => undefined);
        }
        setStatus("live");
      })
      .catch((error: DOMException) => setStatus(error.name === "NotAllowedError" || error.name === "SecurityError" ? "denied" : "unsupported"));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (status !== "live" || paused) return;
    const detector = nativeDetector();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let busy = false;
    const id = setInterval(async () => {
      const v = video.current;
      if (busy || !v || v.readyState < 2 || !v.videoWidth) return;
      busy = true;
      try {
        let text: string | null = null;
        if (detector) {
          text = (await detector.detect(v))[0]?.rawValue ?? null;
        } else if (ctx) {
          const scale = Math.min(1, 640 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          text = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" })?.data ?? null;
        }
        // Faqat talabaPass QR'i; bir xil matn 4 soniya ichida qayta yuborilmaydi
        if (text && parseQr(text) && !(last.current && last.current.text === text && Date.now() - last.current.at < 4000)) {
          last.current = { text, at: Date.now() };
          callback.current(text);
        }
      } finally {
        busy = false;
      }
    }, SCAN_EVERY_MS);
    return () => clearInterval(id);
  }, [status, paused]);

  const toggleTorch = useCallback(async () => {
    if (torch === null || !track.current) return;
    await track.current.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }).catch(() => undefined);
    setTorch(!torch);
  }, [torch]);

  return { video, status, torch, toggleTorch };
}

export type ScannerProps = {
  business: { name: string; initial: string };
  cashierName: string;
  todaySales: number;
  lastSale: { student: string; item: string; time: string } | null;
  /** Pastki navigatsiya (egasi) yoki chiqish (kassir) — server tomonda tanlanadi */
  footer: ReactNode;
};

/** B3 — skaner va B4 — sotuvni tasdiqlash / chek. Qora fon. */
export function ScannerScreen({ business, cashierName, todaySales, lastSale, footer }: ScannerProps) {
  const t = useTranslations("scanner");
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "scan" });
  const [error, setError] = useState<ScanError | null>(null);
  const [pending, start] = useTransition();

  const submit = (input: { qr: string } | { code: string; totp: string }) =>
    start(async () => {
      setError(null);
      const result = await scanAction(input);
      if (result.ok) {
        setStage({ kind: "preview", preview: result.preview, at: formatMinute(toTashkent(new Date()).minute) });
      } else {
        setError({ key: result.result, attemptsLeft: "attemptsLeft" in result ? result.attemptsLeft : undefined });
      }
    });

  const { video, status: cameraStatus, torch, toggleTorch } = useQrCamera((qr) => submit({ qr }), stage.kind !== "scan" || pending);

  // Xato xabari 5 soniyadan keyin yo'qoladi (keyingi skan uchun)
  useEffect(() => {
    if (!error || stage.kind !== "scan") return;
    const id = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(id);
  }, [error, stage.kind]);

  if (stage.kind === "preview") {
    return (
      <SalePreview
        preview={stage.preview}
        at={stage.at}
        onCancel={() => setStage({ kind: "scan" })}
        onDone={(receipt) => {
          setStage({ kind: "done", receipt });
          router.refresh();
        }}
      />
    );
  }
  if (stage.kind === "done") return <SaleDone receipt={stage.receipt} onNext={() => setStage({ kind: "scan" })} />;

  return (
    <div className="flex h-dvh flex-col bg-ink-0 text-paper">
      <div className="flex items-center justify-between px-4 pt-[54px]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-10 bg-orange font-black text-ink font-stretch-125%">{business.initial}</div>
          <div className="flex flex-col">
            <span className="text-15 font-bold" data-testid="cashier-business">
              {business.name}
            </span>
            <span className="text-12 text-fog-3">{t("cashier", { name: cashierName })}</span>
          </div>
        </div>
        <div className="flex flex-col text-right">
          <span className="font-mono text-22 font-semibold" data-testid="today-sales">
            {todaySales}
          </span>
          <span className="text-11 text-fog-3">{t("todaySales")}</span>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-[22px] px-4">
        {stage.kind === "manual" ? (
          <ManualEntry pending={pending} error={error} onSubmit={(code, totp) => submit({ code, totp })} onClose={() => {
              setError(null);
              setStage({ kind: "scan" });
            }}
          />
        ) : (
          <>
            <p className="m-0 text-center text-16 font-semibold whitespace-pre-line">{t("aim")}</p>
            <div className="relative size-[260px] overflow-hidden rounded-22 bg-ink-1">
              <video ref={video} muted playsInline aria-label={t("camera")} className={cn("absolute inset-0 size-full object-cover", cameraStatus !== "live" && "hidden")} />
              {cameraStatus !== "live" ? (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-13 text-fog-1">
                  {cameraStatus === "starting" ? t("cameraStarting") : cameraStatus === "denied" ? t("cameraDenied") : t("cameraUnsupported")}
                </div>
              ) : null}
              <span className="absolute top-0 left-0 size-11 rounded-tl-22 border-0 border-t-4 border-l-4 border-solid border-orange" />
              <span className="absolute top-0 right-0 size-11 rounded-tr-22 border-0 border-t-4 border-r-4 border-solid border-orange" />
              <span className="absolute bottom-0 left-0 size-11 rounded-bl-22 border-0 border-b-4 border-l-4 border-solid border-orange" />
              <span className="absolute right-0 bottom-0 size-11 rounded-br-22 border-0 border-r-4 border-b-4 border-solid border-orange" />
              <span className="scan-line absolute inset-x-[18px] h-0.5 bg-orange" />
            </div>
            {error ? <ScanErrorBox error={error} /> : null}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStage({ kind: "manual" });
                }}
                className="tp-lift flex h-[46px] items-center gap-2 rounded-full border-0 bg-ink-2 px-4 font-sans text-14 font-semibold text-paper">
                <Icon name="keyboard" size={18} />
                {t("enterCode")}
              </button>
              {torch !== null ? (
                <button type="button" aria-label={t("torch")} aria-pressed={torch} onClick={toggleTorch} className={cn("tp-lift flex size-[46px] items-center justify-center rounded-full border-0", torch ? "bg-orange text-ink" : "bg-ink-2 text-paper")}>
                  <Icon name="bolt" size={18} />
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      {lastSale ? (
        <div className="mx-4 mb-3.5 flex items-center gap-3 rounded-14 bg-ink-1 px-3.5 py-3">
          <Icon name="check" size={18} strokeWidth={2.6} className="text-mint-2" />
          <div className="flex-1 text-13 text-fog-1">
            {t.rich("last", { name: lastSale.student, item: lastSale.item, b: (chunks) => <b className="text-white">{chunks}</b> })}
          </div>
          <span className="font-mono text-12 text-fog-3">{lastSale.time}</span>
        </div>
      ) : null}
      {footer}
    </div>
  );
}

function ScanErrorBox({ error }: { error: ScanError }) {
  const t = useTranslations("scanner.errors");
  return (
    <div role="alert" className="w-full max-w-[320px] rounded-14 bg-danger-bg px-3.5 py-3 text-center text-14 font-semibold text-danger">
      {t(error.key as "INVALID")}
      {error.attemptsLeft !== undefined && error.attemptsLeft > 0 ? ` ${t("attemptsLeft", { n: error.attemptsLeft })}` : null}
    </div>
  );
}

/** "Kodni kiritish": kupon kodi VA 6 raqamli kod (faqat kupon kodi hech qachon yetarli emas). Dizaynda chizilmagan. */
function ManualEntry({ pending, error, onSubmit, onClose }: { pending: boolean; error: ScanError | null; onSubmit: (code: string, totp: string) => void; onClose: () => void }) {
  const t = useTranslations("scanner");
  // Boshqariladigan maydonlar: xato bo'lsa kiritilgan kupon kodi o'chib ketmasin (forma action'i uni tozalaydi)
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  return (
    <form
      action={() => onSubmit(code, totp.replace(/\s/g, ""))}
      className="flex w-full max-w-[340px] flex-col gap-3 rounded-22 bg-white p-5 text-ink"
    >
      <b className="text-18">{t("manualTitle")}</b>
      <Field label={t("couponCode")} htmlFor="manual-code">
        <Input id="manual-code" name="code" mono={15} placeholder="TP-7K3Q-92XD" autoCapitalize="characters" autoComplete="off" required value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Field label={t("totpCode")} htmlFor="manual-totp">
        <Input id="manual-totp" name="totp" mono={15} inputMode="numeric" placeholder="000 000" autoComplete="one-time-code" required value={totp} onChange={(e) => setTotp(e.target.value)} />
      </Field>
      {error ? <ScanErrorBox error={error} /> : null}
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button type="button" onClick={onClose} className="tp-btn tp-paint h-12 rounded-12 border-hair border-line bg-white font-sans text-15 font-bold text-ink">
          {t("back")}
        </button>
        <button type="submit" disabled={pending} aria-busy={pending} className="tp-btn tp-stamp [--tp-bar:var(--color-ink)] h-12 rounded-12 border-0 bg-orange font-sans text-15 font-extrabold text-ink disabled:opacity-50">
          {t("check")}
        </button>
      </div>
    </form>
  );
}

/** B4 — QR haqiqiy: talaba, chegirma summalari, to'lov turi, "Sotuvni tasdiqlash". */
function SalePreview({ preview: p, at, onCancel, onDone }: { preview: ScanPreview; at: string; onCancel: () => void; onDone: (r: ReceiptData) => void }) {
  const t = useTranslations("scanner");
  const pay = useTranslations("paymentType");
  const coupon = useTranslations("coupon");
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]>("CASH");
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Narxsiz chegirma: foizli — chek summasi, 1+1 — bitta mahsulot narxi
  const needsAmount = p.finalPrice === null;
  const amount = parseAmount(amountText);
  const computed =
    !needsAmount
      ? { original: p.originalPrice ?? 0, discount: p.discountAmount ?? 0, paid: p.finalPrice ?? 0 }
      : amount
        ? p.bogo
          ? { original: amount * 2, discount: amount, paid: amount }
          : p.percent !== null
            ? { original: amount, discount: amount - priceAfterPercent(amount, p.percent), paid: priceAfterPercent(amount, p.percent) }
            : null
        : null;

  const confirm = () =>
    start(async () => {
      setError(null);
      if (needsAmount && !amount) return setError(t("errors.amount"));
      const result = await confirmSaleAction({ couponId: p.couponId, ticket: p.ticket, paymentType: payment, amount: needsAmount ? amount : null });
      if (result.ok) onDone(result.receipt);
      else setError(t(`errors.${result.error}` as "errors.INVALID"));
    });

  const limitKey = p.limit === "DAILY" ? "limitDaily" : p.limit === "WEEKLY" ? "limitWeekly" : "limitNone";
  const course = p.student.course === "MASTER" ? coupon("master") : coupon("course", { n: p.student.course.slice(1) });

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex items-center gap-3 bg-green px-4 pt-[54px] pb-[18px] text-white">
        <button type="button" onClick={onCancel} aria-label={t("backToScan")} className="tp-lift flex size-11 items-center justify-center rounded-full border-0 bg-green-2 text-white">
          <Icon name="close" size={20} />
        </button>
        <div className="flex-1">
          <div className="text-18 font-extrabold">{t("valid")}</div>
          <div className="font-mono text-12 text-mint-3">
            {p.code} · {at}
          </div>
        </div>
        <Icon name="checkCircle" size={34} />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        <div className="flex items-center gap-3 rounded-16 bg-white p-3.5">
          <div className="flex size-14 items-center justify-center rounded-14 bg-blue text-20 font-black text-white">{p.student.initials}</div>
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="text-17 font-extrabold">{p.student.name}</div>
            <div className="text-13 text-muted">
              {p.student.university} · {course}
            </div>
            <div className="text-12 font-bold text-green">{t("verifiedStudent")}</div>
          </div>
        </div>

        <div className="rounded-16 bg-white px-4 py-3.5">
          <div className="flex items-start justify-between gap-2.5">
            <div>
              <div className="text-12 text-muted">{t("discount")}</div>
              <div className="mt-0.5 text-17 font-extrabold">{p.title}</div>
            </div>
            <DealBadge size="scan">{p.badge}</DealBadge>
          </div>
          {needsAmount ? (
            <Field label={p.bogo ? t("itemPrice") : t("checkAmount")} htmlFor="sale-amount" className="mt-3.5">
              <Input id="sale-amount" mono={15} inputMode="numeric" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="40 000" />
            </Field>
          ) : null}
          {computed ? (
            <div className="mt-3.5 flex flex-col gap-2 font-mono text-14">
              <div className="flex justify-between">
                <span className="text-muted">{t("original")}</span>
                <span>{formatSom(computed.original)}</span>
              </div>
              <div className="flex justify-between text-rust">
                <span>{t("studentDiscount")}</span>
                <span>
                  {MINUS}
                  {formatSom(computed.discount)}
                </span>
              </div>
              <div className="border-t-hair-dashed" />
              <div className="flex items-baseline justify-between">
                <span className="font-sans font-bold">{t("toPay")}</span>
                <span className="text-26 font-semibold" data-testid="sale-total">
                  {formatSom(computed.paid)}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-13 font-semibold">{t("paymentType")}</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENTS.map((type) => (
              <ToggleSquare key={type} day textSize={14} selected={payment === type} onClick={() => setPayment(type)}>
                {pay(type)}
              </ToggleSquare>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-2 px-0.5 pt-0.5 text-13 text-muted">
          <Icon name="info" size={16} />
          {t(limitKey, { n: p.nth })}
        </div>
        {error ? (
          <div role="alert" className="rounded-14 bg-danger-bg px-3.5 py-3 text-14 font-semibold text-danger">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-2 border-0 border-t border-solid border-line-soft px-4 pt-3 pb-[30px]">
        <button type="button" onClick={onCancel} className="tp-btn tp-paint h-14 rounded-14 border-hair border-line bg-white font-sans text-15 font-bold text-ink">
          {t("reject")}
        </button>
        <button type="button" onClick={confirm} disabled={pending} aria-busy={pending} className="tp-btn tp-stamp [--tp-bar:var(--color-ink)] h-14 rounded-14 border-0 bg-orange font-sans text-16 font-extrabold text-ink disabled:opacity-50">
          {t("confirm")}
        </button>
      </div>
    </div>
  );
}

/** B4 tasdiqlangandan keyin: "Chek chiqarildi". */
function SaleDone({ receipt, onNext }: { receipt: ReceiptData; onNext: () => void }) {
  const t = useTranslations("scanner");
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div className="flex flex-1 flex-col px-5 pt-[22px]">
        <div className="text-center text-26 font-black tracking-[-0.02em] font-stretch-110% print:hidden">{t("receiptDone")}</div>
        <div className="mt-4">
          <PrintReceipt r={receipt} />
        </div>
        <p className="mt-3.5 mb-0 text-center text-13 text-muted print:hidden">{t("receiptSent")}</p>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2 px-4 pt-3 pb-[30px] print:hidden">
        <button type="button" onClick={() => window.print()} className="tp-btn tp-paint h-14 rounded-14 border-hair border-line bg-white font-sans text-15 font-bold text-ink">
          {t("print")}
        </button>
        <button type="button" onClick={onNext} className="tp-btn tp-stamp [--tp-shadow:var(--color-orange)] h-14 rounded-14 border-0 bg-ink font-sans text-16 font-extrabold text-white">
          {t("next")}
        </button>
      </div>
    </div>
  );
}
