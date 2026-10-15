import { fromTashkent, toTashkent } from "./time";

/** B6 davrlari: bugun, so'nggi 7 va 30 kun (bugun ham hisobda, Toshkent kunlari). */
export const PERIODS = [1, 7, 30] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = 30;
const DAY_MS = 86_400_000;

export function parsePeriod(value: string | string[] | undefined): Period {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : DEFAULT_PERIOD;
}

export type PeriodRange = {
  period: Period;
  /** Toshkent sanalari (UTC yarim tun), eskisidan yangisiga */
  days: Date[];
  /** [from, to) — UTC lahzalar */
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
};

export function periodRange(period: Period, now: Date): PeriodRange {
  const today = toTashkent(now).date;
  const days = Array.from({ length: period }, (_, i) => new Date(today.getTime() - (period - 1 - i) * DAY_MS));
  const first = days[0]!;
  return {
    period,
    days,
    from: fromTashkent(first),
    to: fromTashkent(new Date(today.getTime() + DAY_MS)),
    prevFrom: fromTashkent(new Date(first.getTime() - period * DAY_MS)),
    prevTo: fromTashkent(first),
  };
}

/** Issiqlik xaritasi: 0 — bo'sh, 1…4 — eng ko'pga nisbatan (chiziqli, har bir band 25%). */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}

/** Soat ustunlari: odatda 08–22 (dizayndagidek); undan tashqarida sotuv bo'lsa kengayadi — yig'indi o'zgarmasligi uchun. */
export function hourRange(hours: number[], from = 8, to = 22): number[] {
  const lo = Math.min(from, ...hours);
  const hi = Math.max(to, ...hours);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
/** Voronka: 1 xonali o'nlik ("11.4") */
export const pct1 = (part: number, whole: number) => (whole > 0 ? (Math.round((part / whole) * 1000) / 10).toFixed(1) : "0.0");

export type Delta = { kind: "abs"; value: number } | { kind: "pct"; value: number } | null;

/** Oldingi davrga nisbatan: bugun — farq (ta), 7/30 kun — foiz. Oldingi davrda sotuv bo'lmasa — ko'rsatilmaydi. */
export function deltaVs(period: Period, current: number, previous: number): Delta {
  if (previous <= 0) return null;
  if (period === 1) return { kind: "abs", value: current - previous };
  return { kind: "pct", value: Math.round(((current - previous) / previous) * 100) };
}

/** Hafta kuni (0 = dushanba … 6 = yakshanba) × soat jadvalidan eng gavjum 3 soatlik oyna va eng bo'sh kun. */
export type HeatGrid = Map<string, number>;
export const heatKey = (weekdayIndex: number, hour: number) => `${weekdayIndex}:${hour}`;

export function busiestWindow(grid: HeatGrid, hours: number[], width = 3) {
  let best: { weekday: number; from: number; to: number; count: number } | null = null;
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let i = 0; i + width <= hours.length; i++) {
      let count = 0;
      for (let k = 0; k < width; k++) count += grid.get(heatKey(weekday, hours[i + k]!)) ?? 0;
      if (count > 0 && (!best || count > best.count)) best = { weekday, from: hours[i]!, to: hours[i + width - 1]! + 1, count };
    }
  }
  return best;
}

export function quietestWeekday(grid: HeatGrid): number | null {
  const totals = Array.from({ length: 7 }, () => 0);
  for (const [key, count] of grid) totals[Number(key.split(":")[0])]! += count;
  if (totals.every((n) => n === 0)) return null;
  return totals.indexOf(Math.min(...totals));
}

/** Grafik o'qining yuqori qiymati: 10 gacha — juft son, 100 gacha — 10 ga, undan katta — 50 ga yaxlitlanadi. */
export function niceMax(max: number): number {
  if (max <= 10) return Math.max(2, Math.ceil(max / 2) * 2);
  const step = max <= 100 ? 10 : 50;
  return Math.ceil(max / step) * step;
}

/** Ustun balandligi (%): bo'sh — 2%, boshqasi kamida 3% (ko'rinib turishi uchun). */
export function barHeight(count: number, axisMax: number): number {
  if (count <= 0 || axisMax <= 0) return 2;
  return Math.max(3, (count / axisMax) * 100);
}
