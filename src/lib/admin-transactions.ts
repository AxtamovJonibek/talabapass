/** Admin "Tranzaksiyalar": filtr parametrlari (URL) — sof mantiq. */

export const TX_PAGE_SIZE = 25;
export const TX_EXPORT_LIMIT = 5000;
export const TX_STATUSES = ["all", "ok", "no"] as const;
export type TxStatus = (typeof TX_STATUSES)[number];
export const TX_PERIODS = ["1", "7", "30", "all"] as const;
export type TxPeriod = (typeof TX_PERIODS)[number];

export type TxFilter = { status: TxStatus; period: TxPeriod; q: string; page: number };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseTxFilter(params: Record<string, string | string[] | undefined>): TxFilter {
  const status = first(params.holat);
  const period = first(params.davr);
  const page = Number(first(params.sahifa));
  return {
    status: (TX_STATUSES as readonly string[]).includes(status ?? "") ? (status as TxStatus) : "all",
    period: (TX_PERIODS as readonly string[]).includes(period ?? "") ? (period as TxPeriod) : "7",
    q: (first(params.q) ?? "").trim().slice(0, 60),
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, 400) : 1,
  };
}

/** Filtrni URL qidiruv qatoriga (standart qiymatlar yozilmaydi). */
export function txQuery(filter: Partial<TxFilter>): string {
  const params = new URLSearchParams();
  if (filter.status && filter.status !== "all") params.set("holat", filter.status);
  if (filter.period && filter.period !== "7") params.set("davr", filter.period);
  if (filter.q) params.set("q", filter.q);
  if (filter.page && filter.page > 1) params.set("sahifa", String(filter.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Qidiruv chek raqami (faqat raqam, 6 gacha) yoki STIR (9 raqam) bo'lishi mumkin. */
export function classifyQuery(q: string): { receipt: number | null; tin: string | null; digits: string } {
  const digits = q.replace(/[\s+()-]/g, "");
  const numeric = /^\d+$/.test(digits);
  return {
    receipt: numeric && digits.length <= 6 ? Number(digits) : null,
    tin: numeric && digits.length === 9 ? digits : null,
    digits: numeric ? digits : "",
  };
}

/** Rad etish sababi: ScanResult → messages kaliti. */
export const FAILED_REASON_KEYS = ["INVALID", "EXPIRED", "REPLAYED", "OUT_OF_HOURS", "LIMIT", "WRONG_BUSINESS", "BLOCKED", "MANUAL_LOCKED"] as const;
