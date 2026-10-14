import { dealBadge, priceAfterPercent } from "./format";
import { crossesMidnight } from "./time";

/**
 * Chegirma qoidalari — forma (brauzer) va server bir xil funksiyani ishlatadi.
 * Server baribir qayta tekshiradi; bazada ham CHECK cheklovlari bor.
 */

export const PERCENT_MIN = 5;
export const PERCENT_MAX = 90;
export const DAILY_LIMIT_MAX = 10_000;
export const PRICE_MAX = 100_000_000;

export type DiscountKind = "PERCENT" | "FIXED_PRICE" | "BOGO";

export type DiscountDraft = {
  title: string;
  type: DiscountKind;
  originalPrice: number | null;
  percent: number | null;
  newPrice: number | null;
  /** 1 = dushanba … 7 = yakshanba */
  weekdays: number[];
  fromMinute: number | null;
  toMinute: number | null;
  dailyLimit: number | null;
  perStudentLimit: "DAILY" | "WEEKLY" | "UNLIMITED";
  /** "YYYY-MM-DD" */
  startsOn: string;
  endsOn: string;
  terms: string;
};

export type DiscountField = "title" | "originalPrice" | "percent" | "newPrice" | "weekdays" | "time" | "dailyLimit" | "dates" | "terms";
export type DiscountProblem =
  | "title"
  | "originalPrice"
  | "percentRange"
  | "newPriceBelowOriginal"
  | "weekdays"
  | "time"
  | "sameTime"
  | "dailyLimit"
  | "dates"
  | "endAfterStart"
  | "startInPast"
  | "terms";

const isInt = (n: number | null): n is number => n !== null && Number.isInteger(n);
/** "YYYY-MM-DD" va haqiqatan mavjud sana (30-fevral emas) */
const isDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Tekshiruv: foiz 5–90; yangi narx asl narxdan kichik (va 0 dan katta); kunlik limit > 0;
 * muddat oxiri boshidan keyin; boshlanish o'tmishda emas; kamida bitta kun; boshlanish va tugash vaqti farqli.
 * `today` — Toshkent sanasi "YYYY-MM-DD".
 */
export function validateDiscount(d: DiscountDraft, today: string): Partial<Record<DiscountField, DiscountProblem>> {
  const errors: Partial<Record<DiscountField, DiscountProblem>> = {};
  const title = d.title.trim();
  if (title.length < 3 || title.length > 80) errors.title = "title";

  const needsPrice = d.type !== "BOGO";
  if (needsPrice && (!isInt(d.originalPrice) || d.originalPrice <= 0 || d.originalPrice > PRICE_MAX)) errors.originalPrice = "originalPrice";
  if (d.type === "BOGO" && d.originalPrice !== null && (!isInt(d.originalPrice) || d.originalPrice <= 0 || d.originalPrice > PRICE_MAX)) {
    errors.originalPrice = "originalPrice";
  }
  if (d.type === "PERCENT" && (!isInt(d.percent) || d.percent < PERCENT_MIN || d.percent > PERCENT_MAX)) errors.percent = "percentRange";
  if (d.type === "FIXED_PRICE") {
    if (!isInt(d.newPrice) || d.newPrice <= 0 || (isInt(d.originalPrice) && d.newPrice >= d.originalPrice)) errors.newPrice = "newPriceBelowOriginal";
  }

  const days = new Set(d.weekdays);
  if (days.size === 0 || [...days].some((w) => !Number.isInteger(w) || w < 1 || w > 7)) errors.weekdays = "weekdays";

  if (!isInt(d.fromMinute) || !isInt(d.toMinute) || d.fromMinute < 0 || d.fromMinute > 1439 || d.toMinute < 1 || d.toMinute > 1440) {
    errors.time = "time";
  } else if (d.fromMinute === d.toMinute || (d.fromMinute === 0 && d.toMinute === 1440)) {
    // 00:00–24:00 ham "kun bo'yi" emas, xato deb hisoblanadi: kun bo'yi — 00:00–23:59
    errors.time = "sameTime";
  }

  if (!isInt(d.dailyLimit) || d.dailyLimit <= 0 || d.dailyLimit > DAILY_LIMIT_MAX) errors.dailyLimit = "dailyLimit";

  if (!isDate(d.startsOn) || !isDate(d.endsOn)) errors.dates = "dates";
  else if (d.endsOn <= d.startsOn) errors.dates = "endAfterStart";
  else if (d.startsOn < today) errors.dates = "startInPast";

  if (d.terms.length > 200) errors.terms = "terms";
  return errors;
}

export type Terms = {
  /** "−30%", "1+1" */
  badge: string;
  originalPrice: number | null;
  discountAmount: number | null;
  finalPrice: number | null;
};

/** Talaba ko'radigan va kuponga snapshot qilinadigan shartlar. */
export function discountTerms(d: Pick<DiscountDraft, "type" | "originalPrice" | "percent" | "newPrice">): Terms {
  if (d.type === "PERCENT" && d.percent !== null) {
    const finalPrice = d.originalPrice !== null ? priceAfterPercent(d.originalPrice, d.percent) : null;
    return {
      badge: dealBadge({ type: "PERCENT", percent: d.percent }),
      originalPrice: d.originalPrice,
      discountAmount: finalPrice !== null && d.originalPrice !== null ? d.originalPrice - finalPrice : null,
      finalPrice,
    };
  }
  if (d.type === "FIXED_PRICE" && d.originalPrice !== null && d.newPrice !== null) {
    return {
      badge: dealBadge({ type: "FIXED_PRICE", originalPrice: d.originalPrice, newPrice: d.newPrice }),
      originalPrice: d.originalPrice,
      discountAmount: d.originalPrice - d.newPrice,
      finalPrice: d.newPrice,
    };
  }
  // 1+1: ikkinchisi bepul — talaba bitta narxini to'laydi
  return {
    badge: dealBadge({ type: "BOGO" }),
    originalPrice: d.originalPrice !== null ? d.originalPrice * 2 : null,
    discountAmount: d.originalPrice,
    finalPrice: d.originalPrice,
  };
}

/** Mazmun o'zgarganmi (qayta tekshiruvga tushadimi): nom, tur, narx/foiz, shartlar. Vaqt, kunlar, limit — yo'q. */
export function contentChanged(
  before: Pick<DiscountDraft, "title" | "type" | "originalPrice" | "percent" | "newPrice" | "terms">,
  after: Pick<DiscountDraft, "title" | "type" | "originalPrice" | "percent" | "newPrice" | "terms">,
): boolean {
  return (
    before.title.trim() !== after.title.trim() ||
    before.type !== after.type ||
    before.originalPrice !== after.originalPrice ||
    before.percent !== after.percent ||
    before.newPrice !== after.newPrice ||
    before.terms.trim() !== after.terms.trim()
  );
}

/** "Du–Ju · 12:00–15:00" kabi ko'rinish uchun: oraliq yarim tundan o'tsa belgi. */
export const isOvernight = crossesMidnight;

// ───────── formadagi matnlarni o'qish / ko'rsatish (B2, WB2) ─────────

/** "38 000" → 38000; "60 ta" → 60. Raqam bo'lmasa null. */
export function parseAmount(value: string): number | null {
  const digits = value.replace(/[\s ]/g, "").replace(/(so'm|so‘m|ta)$/i, "");
  return /^\d{1,9}$/.test(digits) ? Number(digits) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/**
 * "13.10 – 31.10" yoki "13.10.2026 – 31.10.2026" → { startsOn, endsOn } ("YYYY-MM-DD").
 * Yil yozilmasa: boshlanish — joriy yil (sana bugundan yarim yil oldin qolsa — keyingi yil),
 * tugash — boshlanish yili (boshlanishdan oldin qolsa — keyingi yil). Tekshiruv `validateDiscount` da.
 */
export function parseDateRange(value: string, today: string): { startsOn: string; endsOn: string } | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*[–—-]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*$/.exec(value);
  if (!m) return null;
  const [ty, tm, td] = today.split("-").map(Number);
  let startYear = m[3] ? Number(m[3]) : ty;
  if (!m[3]) {
    const monthsBack = (tm - Number(m[2])) + (td > Number(m[1]) ? 0.5 : 0);
    if (monthsBack > 6) startYear += 1;
  }
  const startsOn = iso(startYear, Number(m[2]), Number(m[1]));
  let endYear = m[6] ? Number(m[6]) : startYear;
  if (!m[6] && iso(endYear, Number(m[5]), Number(m[4])) < startsOn) endYear += 1;
  return { startsOn, endsOn: iso(endYear, Number(m[5]), Number(m[4])) };
}

/** "2026-10-13", "2026-10-31" → "13.10 – 31.10" (yil boshqa bo'lsa — yil bilan). */
export function formatDateRange(startsOn: string, endsOn: string, today: string): string {
  const short = (d: string, withYear: boolean) => `${d.slice(8, 10)}.${d.slice(5, 7)}${withYear ? `.${d.slice(0, 4)}` : ""}`;
  const withYear = startsOn.slice(0, 4) !== today.slice(0, 4) || endsOn.slice(0, 4) !== startsOn.slice(0, 4);
  return `${short(startsOn, withYear)} – ${short(endsOn, withYear)}`;
}

/**
 * Hafta kunlari yorlig'i: [1..7] → "Har kuni", [1..5] → "Du–Ju", [6,7] → "Sh–Ya", [1,3] → "Du, Ch".
 * Ketma-ket 3 va undan ko'p kun — oraliq bilan.
 */
export function weekdaysLabel(weekdays: number[], names: (day: number) => string, everyDay: string): string {
  const days = [...new Set(weekdays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (days.length === 7) return everyDay;
  const parts: string[] = [];
  for (let i = 0; i < days.length; ) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
    if (j - i >= 1 && (j - i >= 2 || (days[i] === 6 && days[j] === 7))) parts.push(`${names(days[i])}–${names(days[j])}`);
    else for (let k = i; k <= j; k++) parts.push(names(days[k]));
    i = j + 1;
  }
  return parts.join(", ");
}
