import type { DiscountDraft, DiscountType } from "@/api/business";
import { copy } from "@/copy";
import { FREE_BADGE, formatSom, MINUS, toTashkent } from "./format";

/**
 * Chegirma qoidalari — saytdagi `src/lib/discount.ts` (`validateDiscount`) va `src/lib/format.ts` (`priceAfterPercent`,
 * `dealBadge`) nusxasi: forma darhol xato ko'rsatadi, server baribir qayta tekshiradi. Saytda qoida o'zgarsa — shu yerda ham.
 */

export const PERCENT_MIN = 1;
export const PERCENT_MAX = 100;
export const DAILY_LIMIT_MAX = 10_000;
export const PRICE_MAX = 100_000_000;

export type DiscountField = "title" | "originalPrice" | "percent" | "newPrice" | "weekdays" | "time" | "dailyLimit" | "dates" | "terms";

const isInt = (n: number | null): n is number => n !== null && Number.isInteger(n);
const isDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** Toshkent bugungi sanasi "YYYY-MM-DD" */
export const todayIso = (now = new Date()) => toTashkent(now).date.toISOString().slice(0, 10);

/** Saytdagi `validateDiscount`: { maydon: sabab } (sabab — `copy.biz.editor.errors` kaliti) */
export function validateDiscount(d: DiscountDraft, today: string): Partial<Record<DiscountField, string>> {
  const errors: Partial<Record<DiscountField, string>> = {};
  const title = d.title.trim();
  if (title.length < 3 || title.length > 80) errors.title = "title";

  const needsPrice = d.type !== "BOGO";
  if (needsPrice && (!isInt(d.originalPrice) || d.originalPrice <= 0 || d.originalPrice > PRICE_MAX)) errors.originalPrice = "originalPrice";
  if (d.type === "BOGO" && d.originalPrice !== null && (!isInt(d.originalPrice) || d.originalPrice <= 0 || d.originalPrice > PRICE_MAX)) errors.originalPrice = "originalPrice";
  if (d.type === "PERCENT" && (!isInt(d.percent) || d.percent < PERCENT_MIN || d.percent > PERCENT_MAX)) errors.percent = "percentRange";
  if (d.type === "FIXED_PRICE" && (!isInt(d.newPrice) || d.newPrice <= 0 || (isInt(d.originalPrice) && d.newPrice >= d.originalPrice))) errors.newPrice = "newPriceBelowOriginal";

  const days = new Set(d.weekdays);
  if (days.size === 0 || [...days].some((w) => !Number.isInteger(w) || w < 1 || w > 7)) errors.weekdays = "weekdays";

  if (!isInt(d.fromMinute) || !isInt(d.toMinute) || d.fromMinute < 0 || d.fromMinute > 1439 || d.toMinute < 1 || d.toMinute > 1440) errors.time = "time";
  else if (d.fromMinute === d.toMinute || (d.fromMinute === 0 && d.toMinute === 1440)) errors.time = "sameTime";

  if (!isInt(d.dailyLimit) || d.dailyLimit <= 0 || d.dailyLimit > DAILY_LIMIT_MAX) errors.dailyLimit = "dailyLimit";

  if (!isDate(d.startsOn) || !isDate(d.endsOn)) errors.dates = "dates";
  else if (d.endsOn <= d.startsOn) errors.dates = "endAfterStart";
  else if (d.startsOn < today) errors.dates = "startInPast";

  if (d.terms.length > 200) errors.terms = "terms";
  return errors;
}

export const priceAfterPercent = (originalPrice: number, percent: number) => Math.round((originalPrice * (100 - percent)) / 100 / 100) * 100;

/** "−30%", "1+1", "BEPUL" */
export function discountBadge(d: { type: DiscountType; percent: number | null; originalPrice: number | null; newPrice: number | null }): string {
  if (d.type === "BOGO") return "1+1";
  if (d.type === "PERCENT") return (d.percent ?? 0) >= 100 ? FREE_BADGE : `${MINUS}${d.percent ?? 0}%`;
  if (d.originalPrice && d.newPrice !== null) return `${MINUS}${Math.round((1 - d.newPrice / d.originalPrice) * 100)}%`;
  return "";
}

/** Ro'yxatdagi qisqa narx: "26 600 so'm (38 000 o'rniga) · −30%" yoki "1+1" */
export function discountPriceText(d: { type: DiscountType; percent: number | null; originalPrice: number | null; newPrice: number | null }): string {
  const badge = discountBadge(d);
  const final = d.type === "PERCENT" && d.originalPrice ? priceAfterPercent(d.originalPrice, d.percent ?? 0) : d.type === "FIXED_PRICE" ? d.newPrice : null;
  if (final === null || !d.originalPrice) return badge;
  return `${formatSom(final)} ${copy.currency} · ${copy.biz.discounts.insteadOf(formatSom(d.originalPrice))} · ${badge}`;
}

// ───────── forma matnlari ─────────

/** "38 000" → 38000; bo'sh yoki raqam emas — null */
export function parseAmount(value: string): number | null {
  const digits = value.replace(/[\s ]/g, "");
  return /^\d{1,9}$/.test(digits) ? Number(digits) : null;
}

/** "9:30", "09:30", "24:00" → daqiqa; noto'g'ri — null */
export function parseTime(value: string): number | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** "13.10.2026" → "2026-10-13"; noto'g'ri — matnning o'zi (tekshiruv `dates` xatosini beradi) */
export function parseDate(value: string): string {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(value);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : value.trim();
}

/** "2026-10-13" → "13.10.2026" */
export const dateField = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join(".") : iso);

/** Yangi chegirma uchun boshlang'ich forma: bugundan 30 kun, ish kunlari 12:00–15:00, kuniga 30 ta */
export function emptyDraft(now = new Date()): DiscountDraft {
  const today = todayIso(now);
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);
  return { title: "", type: "PERCENT", originalPrice: null, percent: 20, newPrice: null, weekdays: [1, 2, 3, 4, 5], fromMinute: 720, toMinute: 900, dailyLimit: 30, perStudentLimit: "DAILY", startsOn: today, endsOn: end, terms: "" };
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Saytdagi `parseDateRange`: "13.10 – 31.10" (yil ixtiyoriy) → ISO sanalar; yil tanlovi bugungi sanaga qarab. */
export function parseDateRange(value: string, today: string): { startsOn: string; endsOn: string } | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*[–—-]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*$/.exec(value);
  if (!m) return null;
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let startYear = m[3] ? Number(m[3]) : ty;
  if (!m[3]) {
    const monthsBack = tm - Number(m[2]) + (td > Number(m[1]) ? 0.5 : 0);
    if (monthsBack > 6) startYear += 1;
  }
  const startsOn = iso(startYear, Number(m[2]), Number(m[1]));
  let endYear = m[6] ? Number(m[6]) : startYear;
  if (!m[6] && iso(endYear, Number(m[5]), Number(m[4])) < startsOn) endYear += 1;
  return { startsOn, endsOn: iso(endYear, Number(m[5]), Number(m[4])) };
}

/** Saytdagi `formatDateRange`: "2026-10-13", "2026-10-31" → "13.10 – 31.10" (yil boshqa bo'lsa — yil bilan). */
export function formatDateRange(startsOn: string, endsOn: string, today: string): string {
  const short = (d: string, withYear: boolean) => `${d.slice(8, 10)}.${d.slice(5, 7)}${withYear ? `.${d.slice(0, 4)}` : ""}`;
  const withYear = startsOn.slice(0, 4) !== today.slice(0, 4) || endsOn.slice(0, 4) !== startsOn.slice(0, 4);
  return `${short(startsOn, withYear)} – ${short(endsOn, withYear)}`;
}

/** Saytdagi `discountTerms`: yorliq, asl narx, chegirma summasi va to'lanadigan narx (1+1 — bitta narx). */
export function discountTerms(d: { type: DiscountType; originalPrice: number | null; percent: number | null; newPrice: number | null }) {
  if (d.type === "PERCENT" && d.percent !== null) {
    const finalPrice = d.originalPrice !== null ? priceAfterPercent(d.originalPrice, d.percent) : null;
    return { badge: discountBadge(d), originalPrice: d.originalPrice, discountAmount: finalPrice !== null && d.originalPrice !== null ? d.originalPrice - finalPrice : null, finalPrice };
  }
  if (d.type === "FIXED_PRICE" && d.originalPrice !== null && d.newPrice !== null) {
    return { badge: discountBadge(d), originalPrice: d.originalPrice, discountAmount: d.originalPrice - d.newPrice, finalPrice: d.newPrice };
  }
  return { badge: discountBadge({ ...d, type: "BOGO" }), originalPrice: d.originalPrice !== null ? d.originalPrice * 2 : null, discountAmount: d.originalPrice, finalPrice: d.originalPrice };
}
