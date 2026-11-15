import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, errorText, isNetworkError } from "@/api/client";
import { resetTo, routeFor, useApp } from "@/state";

export type Load<T> = {
  data: T | null;
  /** Foydalanuvchiga ko'rsatiladigan matn */
  error: string | null;
  /** Server xato kodi (`not_found`…) */
  code: string | null;
  offline: boolean;
  /** Birinchi yuklanish (ma'lumot hali yo'q) */
  loading: boolean;
  /** Pull-to-refresh */
  refreshing: boolean;
  reload: () => Promise<void>;
  /** Ko'rsatkichsiz yangilash (fokusga qaytganda) */
  refresh: () => Promise<void>;
  setData: (fn: (data: T | null) => T | null) => void;
};

/**
 * Ekran ma'lumoti: yuklanish / xato / pull-to-refresh. Eski so'rov javobi yangisini bosib ketmaydi (tartib raqami).
 * Talaba tasdig'i o'chgan bo'lsa (403 `student_not_approved` — muddati o'tgan, bloklangan) — `me` yangilanib,
 * o'z ekraniga (guvohnoma yuklash yoki tekshiruv) o'tiladi.
 */
export function useLoad<T>(fn: () => Promise<T>, enabled = true): Load<T> {
  const { reloadMe } = useApp();
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  /** Javobni qo'llash — faqat eng oxirgi so'rovniki (`id`) */
  const settle = useCallback(
    (id: number, result: { ok: true; value: T } | { ok: false; error: unknown }) => {
      if (id !== seq.current) return;
      setRefreshing(false);
      if (result.ok) {
        setDataState(result.value);
        setError(null);
        return;
      }
      if (result.error instanceof ApiError && result.error.code === "student_not_approved") {
        void reloadMe().then((me) => resetTo(routeFor(me)), () => undefined);
      }
      setError(result.error);
    },
    [reloadMe],
  );

  const start = useCallback(() => {
    const id = ++seq.current;
    return fn().then(
      (value) => settle(id, { ok: true, value }),
      (error: unknown) => settle(id, { ok: false, error }),
    );
  }, [fn, settle]);

  // Birinchi yuklanish va `fn` o'zgarganda (masalan, joy tanlandi): eski ma'lumot yangisi kelguncha ko'rinib turadi
  useEffect(() => {
    if (enabled) void start();
  }, [enabled, start]);

  const setData = useCallback((update: (data: T | null) => T | null) => setDataState(update), []);
  const reload = useCallback(() => {
    setRefreshing(true);
    return start();
  }, [start]);

  return {
    data,
    error: error ? errorText(error) : null,
    code: error instanceof ApiError ? error.code : null,
    offline: isNetworkError(error),
    loading: enabled && data === null && error === null,
    refreshing,
    reload,
    refresh: start,
    setData,
  };
}
