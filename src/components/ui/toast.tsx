"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/**
 * Qisqa xabar (toast): siyoh fon, oq matn, chapda holat belgisi. Dizaynda chizilmagan — mavjud tokenlardan
 * (ink, white, green-live, orange). `toast("Saqlandi")` istalgan klient komponentdan; `<Toaster />` ilova
 * layout'ida bir marta turadi. Pastdan chiqadi va shu yo'nalishda ketadi, 2.6 s turadi; sahifa yashirin
 * bo'lsa taymer to'xtaydi. Bir vaqtda bitta — yangisi eskisini almashtiradi.
 */
type Tone = "ok" | "info";
type ToastItem = { id: number; text: string; tone: Tone; leaving: boolean };

const SHOW_MS = 2600;
const LEAVE_MS = 200;
let current: ToastItem | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let deadline = 0;
let remaining = 0;
const listeners = new Set<() => void>();

function set(next: ToastItem | null) {
  current = next;
  listeners.forEach((l) => l());
}

function schedule(ms: number) {
  clearTimeout(timer);
  deadline = Date.now() + ms;
  timer = setTimeout(() => {
    if (!current) return;
    set({ ...current, leaving: true });
    timer = setTimeout(() => set(null), LEAVE_MS);
  }, ms);
}

export function toast(text: string, tone: Tone = "ok") {
  set({ id: ++seq, text, tone, leaving: false });
  schedule(SHOW_MS);
}

function onVisibility() {
  if (!current || current.leaving) return;
  if (document.hidden) {
    clearTimeout(timer);
    remaining = Math.max(deadline - Date.now(), 0);
  } else schedule(Math.max(remaining, 800));
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) document.addEventListener("visibilitychange", onVisibility);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) document.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Pastki navigatsiya (84px) ustida turadi. */
export function Toaster() {
  const item = useSyncExternalStore(subscribe, () => current, () => null);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[100px] z-50 flex justify-center px-4">
      {item ? (
        <div
          key={item.id}
          data-testid="toast"
          data-leaving={item.leaving || undefined}
          className={cn(
            "pointer-events-auto flex max-w-[420px] items-center gap-2.5 rounded-14 bg-ink py-3 pr-4 pl-3 text-14 font-semibold text-white",
            // Kirish: pastdan, ease-out 260ms. Chiqish: shu yo'nalishda, tezroq (200ms).
            "transition-[translate,opacity] duration-[260ms] ease-out starting:translate-y-full starting:opacity-0",
            "data-leaving:translate-y-3 data-leaving:opacity-0 data-leaving:duration-200",
          )}
        >
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-ink", item.tone === "ok" ? "bg-green-live" : "bg-orange")}>
            <Icon name={item.tone === "ok" ? "check" : "info"} size={14} strokeWidth={3} />
          </span>
          {item.text}
        </div>
      ) : null}
    </div>
  );
}
