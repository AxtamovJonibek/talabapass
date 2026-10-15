import { fromTashkent, toTashkent } from "./time";

/** A1 (admin umumiy) uchun sof hisoblar — manba SQL, bu yerda faqat shakllantirish (vitest bilan tekshiriladi). */

export const OVERVIEW_DAYS = 30;
/** Dizayndagi chiziq ko'rsatkichi: "yangi talabalar ×10" — sotuv o'qiga moslash uchun. */
export const NEW_STUDENTS_FACTOR = 10;

const DAY_MS = 86_400_000;

/** Bugundan orqaga `n` kun (Toshkent sanalari, eskisi birinchi). */
export function lastDays(n: number, now: Date): Date[] {
  const today = toTashkent(now).date;
  return Array.from({ length: n }, (_, i) => new Date(today.getTime() - (n - 1 - i) * DAY_MS));
}

/** Toshkent kunlarining [from, to) UTC chegaralari. */
export function dayBounds(day: Date): { from: Date; to: Date } {
  return { from: fromTashkent(day), to: fromTashkent(new Date(day.getTime() + DAY_MS)) };
}

/** Grafik o'qining yuqori qiymati: 1 / 2 / 2.5 / 4 / 5 / 10 × 10^k ("yumaloq") — 3 906 → 4 000. Kamida 4. */
export function niceAxis(max: number): number {
  if (max <= 4) return 4;
  const base = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 4, 5, 10]) {
    if (max <= step * base) return step * base;
  }
  return 10 * base;
}

/** Bugungi sotuv o'tgan haftaning shu kuniga nisbatan, %. O'tgan hafta 0 bo'lsa ko'rsatilmaydi. */
export function weekOverWeek(today: number, sameDayLastWeek: number): number | null {
  if (sameDayLastWeek <= 0) return null;
  return Math.round(((today - sameDayLastWeek) / sameDayLastWeek) * 100);
}

export type ShareRow = { key: string; count: number; percent: number };

/**
 * Kategoriyalar ulushi: eng ko'pi `top` ta + qolgani "other". Foizlar yig'indisi aniq 100 (eng katta qoldiq usuli),
 * aks holda yaxlitlash natijasida ustun 99% yoki 101% bo'lib qolardi. Sotuv bo'lmasa — bo'sh ro'yxat.
 */
export function categoryShares(rows: { key: string; count: number }[], top = 5): ShareRow[] {
  const sorted = rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const total = sorted.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return [];
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((sum, r) => sum + r.count, 0);
  const items = rest > 0 ? [...head, { key: "other", count: rest }] : head;

  const exact = items.map((r) => (r.count / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index]!++;
    left--;
  }
  return items.map((r, i) => ({ key: r.key, count: r.count, percent: floors[i]! }));
}

/** Sotuv ustuni balandligi, % (bo'sh kun — 0). */
export const barPercent = (count: number, axisMax: number) => (axisMax > 0 ? Math.min(100, (count / axisMax) * 100) : 0);

/** SVG polyline (viewBox 0 0 300 100): har kunning markazida; qiymat sotuv o'qida (×10). */
export function linePoints(newStudents: number[], axisMax: number): string {
  const n = newStudents.length;
  return newStudents
    .map((value, i) => {
      const x = (i + 0.5) * (300 / n);
      const y = 100 - Math.min(100, (value * NEW_STUDENTS_FACTOR * 100) / axisMax);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** 0 → "0", 4000 → "4 000" kabi o'q yozuvlari: [yuqori, o'rta, 0]. */
export const axisTicks = (axisMax: number): [number, number, number] => [axisMax, axisMax / 2, 0];

/** "Tranzaksiyalar" davri: bugun / 7 / 30 kun (Toshkent kunlari) / hammasi (null). */
export function periodStart(period: "1" | "7" | "30" | "all", now: Date): Date | null {
  if (period === "all") return null;
  const days = lastDays(Number(period), now);
  return fromTashkent(days[0]!);
}
