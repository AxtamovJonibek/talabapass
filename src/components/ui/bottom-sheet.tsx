"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Sarlavha — dialog nomi ham (aria-labelledby) */
  title: ReactNode;
  /** Sarlavha ostidagi qator (manzil, izoh) */
  description?: ReactNode;
  /** Yopish tugmasining nomi (ekran o'qigich) */
  closeLabel: string;
  /** Kompyuterda (≥ 700px) oyna shu element ostida popover bo'lib ochiladi; bo'lmasa — har doim pastdan */
  anchor?: RefObject<HTMLElement | null>;
  /** Popover ochilganda fokus oladigan element (telefonda — dialogning o'zi, klaviatura o'zi chiqmasin) */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Popover kengligi, px */
  width?: number;
  children: ReactNode;
};

const WIDE = "(min-width: 700px)";
const LEAVE_MS = 220;
/** Shuncha pastga tortilsa (yoki tez siltansa) yopiladi */
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 0.55; // px/ms
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Pastdan chiqadigan oyna (bottom sheet) — joy tanlovi, yo'nalish, keyin bron oynasi. Dizaynda chizilmagan, mavjud
 * tokenlardan: paper fon, 22 radius, ink/40 parda, `--ease-drawer`.
 * - Telefon: pastdan ko'tariladi, tepada tutqich; tutqich/sarlavhadan pastga surilsa yoki parda bosilsa yopiladi.
 * - Kompyuter (`anchor` berilsa): tugma ostida popover, pardasiz.
 * - Dialog: `role="dialog"`, `aria-modal`, fokus ichida aylanadi (Tab), Esc yopadi, yopilgach fokus tugmaga qaytadi.
 * `prefers-reduced-motion` — globals.css (o'tishlar 1ms).
 */
export function BottomSheet({ open, onClose, title, description, closeLabel, anchor, initialFocus, width = 400, children }: BottomSheetProps) {
  const uid = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  const popover = wide && anchor !== undefined;
  // Yopilganda chiqish animatsiyasi tugaguncha DOM'da qoladi (holat render paytida moslanadi — effektsiz)
  const [shown, setShown] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setShown(true);
  }
  const leaving = shown && !open;
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ start: number; last: number; at: number; v: number } | null>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      setShown(false);
      setDragY(0);
    }, LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  // Popover joyi (birinchi chizilishdan oldin): tugma ostida; pastda joy kam bo'lsa — tepasida. Tugma ekranning o'ng
  // yarmida bo'lsa o'ng chetlari tekislanadi. Ekrandan chiqmaydi.
  useLayoutEffect(() => {
    const a = anchor?.current;
    const el = dialog.current;
    if (!open || !popover || !a || !el) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(width, vw - 16);
    const below = vh - r.bottom - 16;
    const above = r.top - 16;
    const up = below < 360 && above > below;
    const left = r.left + r.width / 2 > vw / 2 ? r.right - w : r.left;
    Object.assign(el.style, {
      top: up ? "auto" : `${r.bottom + 8}px`,
      bottom: up ? `${vh - r.top + 8}px` : "auto",
      left: `${Math.min(Math.max(8, left), vw - w - 8)}px`,
      width: `${w}px`,
      maxHeight: `${Math.max(200, (up ? above : below) - 8)}px`,
    });
  }, [open, popover, anchor, width]);

  // Fokus: ochilganda ichkariga, yopilganda oldingi joyiga (tugmaga). `initialFocus` faqat popover'da — telefonda
  // maydonga fokus klaviaturani ochib, ro'yxatni yopib qo'yadi.
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    ((popover && initialFocus?.current) || dialog.current)?.focus({ preventScroll: true });
    return () => {
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open, popover, initialFocus]);

  // Sahifa orqada surilmasin (popover ham tugmaga bog'langan — sahifa siljisa ajralib qoladi); o'lcham o'zgarsa popover yopiladi
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const hide = () => close.current();
    if (popover) window.addEventListener("resize", hide);
    return () => {
      root.style.overflow = before;
      window.removeEventListener("resize", hide);
    };
  }, [open, popover]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close.current();
      return;
    }
    if (e.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === dialog.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Pastga surib yopish (faqat telefon ko'rinishida, tutqich va sarlavha qismidan)
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (popover || e.button !== 0 || (e.target as HTMLElement).closest("button, a, input")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: e.clientY, last: e.clientY, at: e.timeStamp, v: 0 };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dt = Math.max(1, e.timeStamp - d.at);
    d.v = (e.clientY - d.last) / dt;
    d.last = e.clientY;
    d.at = e.timeStamp;
    const raw = e.clientY - d.start;
    // Yuqoriga — qarshilik bilan bir oz, pastga — barmoq ortidan
    setDragY(raw < 0 ? Math.max(-16, raw / 4) : raw);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.last - d.start > CLOSE_DISTANCE || d.v > CLOSE_VELOCITY) close.current();
    else setDragY(0);
  };

  if (!shown) return null;

  const header = (
    <div className="flex items-start gap-3 px-5 pt-1 pb-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id={`${uid}-title`} className="m-0 text-20 leading-[1.1] font-extrabold tracking-[-0.02em] font-stretch-108%">
          {title}
        </h2>
        {description ? <div className="text-14 text-muted">{description}</div> : null}
      </div>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={() => close.current()}
        className="tp-lift -mt-0.5 -mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink"
      >
        <Icon name="close" size={16} strokeWidth={2.4} />
      </button>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-40" data-testid="bottom-sheet">
      <div
        aria-hidden="true"
        onClick={() => close.current()}
        className={cn(
          "absolute inset-0 touch-none transition-opacity duration-300 ease-out",
          popover ? "bg-transparent" : "bg-ink/40 starting:opacity-0",
          leaving && "opacity-0 duration-200",
        )}
      />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-leaving={leaving || undefined}
        style={!popover && dragY && !leaving ? { translate: `0 ${dragY}px` } : undefined}
        className={cn(
          "absolute flex flex-col bg-paper text-ink outline-none",
          popover
            ? "rounded-18 border-hair border-line shadow-card-hover transition-[translate,opacity] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 data-leaving:-translate-y-1 data-leaving:opacity-0"
            : cn(
                "inset-x-0 bottom-0 mx-auto max-h-[calc(100dvh-40px)] w-full max-w-[560px] rounded-t-22 pb-[max(16px,env(safe-area-inset-bottom))]",
                "starting:translate-y-full data-leaving:translate-y-full",
                dragging ? "transition-none" : "transition-[translate] duration-[380ms] ease-drawer data-leaving:duration-200 data-leaving:ease-out",
              ),
        )}
      >
        {popover ? (
          <div className="pt-4">{header}</div>
        ) : (
          <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing">
            <div className="flex justify-center pt-2.5 pb-2">
              <span className="h-[5px] w-10 rounded-3 bg-line" />
            </div>
            {header}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
