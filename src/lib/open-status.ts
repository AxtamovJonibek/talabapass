import { toTashkent, type DealTiming } from "./time";

const DAY_MS = 86_400_000;
/** Shundan kam qolsa — "45 daqiqadan keyin ochiladi" */
export const SOON_MINUTES = 60;

/**
 * Holat pilyulkasi (`StatusPill`) uchun: hozir ochiq, tez orada, bugun keyinroq yoki yopiq (keyingi ochilish kuni bilan).
 * Kirish — `dealTiming` natijasi (ochiq bo'lsa yopilish, yopiq bo'lsa keyingi ochilish lahzasi; yarim tundan o'tadigan
 * oraliqlar o'sha yerda hisoblangan). Kunlar Toshkent vaqtida.
 */
export type OpenStatus =
  | { kind: "open"; closesAt: Date }
  | { kind: "soon"; minutes: number; opensAt: Date }
  | { kind: "today"; opensAt: Date }
  /** `inDays` — Toshkent kunlari farqi (1 — ertaga), `weekday` 1..7 */
  | { kind: "closed"; opensAt: Date; inDays: number; weekday: number }
  /** Boshqa ochilish yo'q (muddat tugagan) */
  | { kind: "ended" };

export function openStatus(timing: { live: boolean; closesAt: string | Date | null; opensAt: string | Date | null }, now: Date): OpenStatus {
  if (timing.live && timing.closesAt) return { kind: "open", closesAt: new Date(timing.closesAt) };
  if (!timing.opensAt) return { kind: "ended" };
  const opensAt = new Date(timing.opensAt);
  const minutes = Math.ceil((opensAt.getTime() - now.getTime()) / 60_000);
  if (minutes < SOON_MINUTES) return { kind: "soon", minutes: Math.max(1, minutes), opensAt };
  const target = toTashkent(opensAt);
  const inDays = Math.round((target.date.getTime() - toTashkent(now).date.getTime()) / DAY_MS);
  if (inDays <= 0) return { kind: "today", opensAt };
  return { kind: "closed", opensAt, inDays, weekday: target.weekday };
}

/** `dealTiming` (server) → pilyulka holati */
export const statusFromTiming = (timing: DealTiming | null, now: Date): OpenStatus =>
  openStatus(
    timing ? { live: timing.live, closesAt: timing.live ? timing.closesAt : null, opensAt: timing.live ? null : timing.opensAt } : { live: false, closesAt: null, opensAt: null },
    now,
  );
