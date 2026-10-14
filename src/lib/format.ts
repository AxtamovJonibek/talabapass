/** Dizayndagi minus belgisi (U+2212) — defis emas. */
export const MINUS = "−";

/** 26600 → "26 600". So'mda tiyin yo'q, shuning uchun faqat butun son. */
export function formatSom(amount: number): string {
  const sign = amount < 0 ? MINUS : "";
  return sign + String(Math.abs(Math.trunc(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 1 220 000 → "1.22 mln", 30 120 000 → "30.1 mln"; million dan kichigi formatSom bilan. */
export function formatMln(amount: number): string {
  if (Math.abs(amount) < 1_000_000) return formatSom(amount);
  const digits = Math.abs(amount) >= 10_000_000 ? 1 : 2;
  const value = (amount / 1_000_000).toFixed(digits).replace(/\.?0+$/, "");
  return `${value} mln`;
}

/** Foizli chegirmadan keyingi narx — dizayndagidek 100 so'mgacha yaxlitlanadi. */
export function priceAfterPercent(originalPrice: number, percent: number): number {
  return Math.round((originalPrice * (100 - percent)) / 100 / 100) * 100;
}

export type BadgeInput =
  | { type: "PERCENT"; percent: number }
  | { type: "FIXED_PRICE"; originalPrice: number; newPrice: number }
  | { type: "BOGO" };

/** Kartadagi yorliq: "−30%", "1+1". */
export function dealBadge(input: BadgeInput): string {
  switch (input.type) {
    case "PERCENT":
      return `${MINUS}${input.percent}%`;
    case "FIXED_PRICE":
      return `${MINUS}${Math.round((1 - input.newPrice / input.originalPrice) * 100)}%`;
    case "BOGO":
      return "1+1";
  }
}

/** "+998904123785" → "+998 90 412 37 85" */
export function formatPhone(e164: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/**
 * Foydalanuvchi kiritgan raqamni E.164 ga keltiradi; noto'g'ri bo'lsa null.
 * Faqat O'zbekiston raqamlari: natija har doim +998 va 9 raqam. Boshqa davlat kodi ("+7…", "+1…") rad etiladi.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("+") && !/^\+\s*998/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const local = digits.startsWith("998") && digits.length === 12 ? digits.slice(3) : digits;
  return /^\d{9}$/.test(local) ? `+998${local}` : null;
}

/** Telefon maydoniga qaytarib qo'yish uchun "+998" siz qism: "+998901234567" → "90 123 45 67". Tanilmasa — o'zi. */
export function phoneNational(value: string): string {
  const phone = normalizePhone(value);
  return phone ? formatPhone(phone).replace(/^\+998 /, "") : value;
}

/** Ism va familiyadan bosh harflar: "Dilnoza Karimova" → "DK" */
export function initials(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName]
    .map((part) => part?.trim().charAt(0).toUpperCase() ?? "")
    .join("");
}
