import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { bizApi } from "@/api/business";
import { signal } from "@/lib/sound";

/**
 * Yangi buyurtmalar (faqat egasi): ilova ochiq paytda 15 soniyada `GET /business/orders?filter=new` so'raladi; `newIds`
 * ichida avval ko'rilmagan id paydo bo'lsa — tovush va tebranish (saytdagi buyurtmalar panelidagi signal kabi).
 * Oldindan buyurtma o'chiq bo'lsa so'rov 5 daqiqada bir marta (yoqilganini bilish uchun). Ilova fonda — so'rov yo'q
 * (u paytda push keladi).
 */

const FAST_MS = 15_000;
const SLOW_MS = 5 * 60_000;

type Ctx = { enabled: boolean; waiting: number; refresh: () => void };
const OrdersContext = createContext<Ctx>({ enabled: false, waiting: 0, refresh: () => undefined });

export function OrdersWatch({ active, children }: { active: boolean; children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(false);

  // So'rov o'zini keyingi taymerga qo'yadi — funksiya ref'da (render paytida emas, effektda yangilanadi)
  const poll = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => {
    poll.current = async () => {
      if (timer.current) clearTimeout(timer.current);
      let next = SLOW_MS;
      try {
        const data = await bizApi.orders("new");
        setEnabled(data.enabled);
        setWaiting(data.newIds.length);
        const fresh = data.newIds.filter((id) => !seen.current?.has(id));
        // Birinchi so'rovda — faqat eslab qolinadi (ilova ochilganda eski buyurtmalar uchun signal chalinmaydi)
        if (seen.current && fresh.length > 0) signal("order");
        seen.current = new Set([...(seen.current ?? []), ...data.newIds]);
        if (data.enabled || data.newIds.length > 0) next = FAST_MS;
      } catch {
        next = FAST_MS * 2;
      }
      if (live.current && AppState.currentState === "active") timer.current = setTimeout(() => void poll.current(), next);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    live.current = true;
    void poll.current();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void poll.current();
      else if (timer.current) clearTimeout(timer.current);
    });
    return () => {
      live.current = false;
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active]);

  const value = useMemo(() => ({ enabled, waiting, refresh: () => void poll.current() }), [enabled, waiting]);
  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export const useOrdersWatch = () => useContext(OrdersContext);
