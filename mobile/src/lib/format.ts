import { copy } from "@/copy";

/**
 * Narx, vaqt va holat yozuvlari — saytdagi `src/lib/format.ts`, `src/lib/time.ts`, `src/lib/open-status.ts` va
 * `feed/labels.ts` bilan bir xil qoidalar. Vaqt Toshkentda (UTC+5, yozgi vaqt yo'q) — qurilma soat mintaqasidan qat'i nazar.
 */

export const MINUS = "−";
export const FREE_BADGE = "BEPUL";
const OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** 26600 → "26 600" */
export function formatSom(amount: number): string {
  const sign = amount < 0 ? MINUS : "";
  return sign + String(Math.abs(Math.trunc(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Toshkent sanasi (UTC yarim tun), hafta kuni (1 = dushanba) va kun boshidan daqiqa. */
export function toTashkent(instant: Date) {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return {
    date: new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())),
    weekday: shifted.getUTCDay() === 0 ? 7 : shifted.getUTCDay(),
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** 720 → "12:00" */
export function formatMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export const clock = (iso: string) => formatMinute(toTashkent(new Date(iso)).minute);

/** "13.11" */
const dayMonth = (date: Date) => `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const daysBetween = (from: Date, to: Date) => Math.round((toTashkent(to).date.getTime() - toTashkent(from).date.getTime()) / DAY_MS);

export type PillTone = "open" | "soon" | "closed";

/** Holat pilyulkasi: "Hozir ochiq · 23:00 gacha", "45 daqiqadan keyin ochiladi", "Yopiq · ertaga 09:00 da"… */
export function statusPill(deal: { live: boolean; closesAt: string | null; opensAt: string | null }, now: Date): { tone: PillTone; text: string } {
  const s = copy.deal.status;
  if (deal.live && deal.closesAt) return { tone: "open", text: s.open(clock(deal.closesAt)) };
  if (!deal.opensAt) return { tone: "closed", text: s.ended };
  const opensAt = new Date(deal.opensAt);
  const minutes = Math.ceil((opensAt.getTime() - now.getTime()) / 60_000);
  if (minutes < 60) return { tone: "soon", text: s.soon(Math.max(1, minutes)) };
  const inDays = daysBetween(now, opensAt);
  const time = clock(deal.opensAt);
  if (inDays <= 0) return { tone: "soon", text: s.today(time) };
  if (inDays === 1) return { tone: "closed", text: s.tomorrow(time) };
  if (inDays < 7) return { tone: "closed", text: s.weekday(copy.weekdays[toTashkent(opensAt).weekday - 1]!, time) };
  return { tone: "closed", text: s.date(dayMonth(toTashkent(opensAt).date)) };
}

/** Birinchi harf katta: "ertaga 09:00 da ochiladi" → "Ertaga 09:00 da ochiladi" */
export const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Yopiq chegirma qachon ochiladi (Chegirma.dc.html tugmasi va holat qatori): "45 daqiqadan keyin", "bugun 16:00 da",
 * "ertaga 09:00 da", "Dushanba 09:00 da", "13.11 dan". Keyingi ochilish yo'q (aksiya tugagan) — null.
 */
export function opensWhen(deal: { opensAt: string | null }, now: Date): string | null {
  const w = copy.deal.opensWhen;
  if (!deal.opensAt) return null;
  const opensAt = new Date(deal.opensAt);
  const minutes = Math.ceil((opensAt.getTime() - now.getTime()) / 60_000);
  if (minutes < 60) return w.soon(Math.max(1, minutes));
  const inDays = daysBetween(now, opensAt);
  const time = clock(deal.opensAt);
  if (inDays <= 0) return w.today(time);
  if (inDays === 1) return w.tomorrow(time);
  if (inDays < 7) return w.weekday(copy.weekdays[toTashkent(opensAt).weekday - 1]!, time);
  return w.date(dayMonth(toTashkent(opensAt).date));
}

/** Narxsiz chegirma matni: egasi yozgani yoki "Chek summasidan −15%" / "Ikkinchisi bepul" / "Bepul". */
export function dealNote(deal: { note: string | null; badge: string }): string {
  if (deal.note) return deal.note;
  if (deal.badge === "1+1") return copy.deal.bogo;
  if (deal.badge === FREE_BADGE) return copy.deal.free;
  return copy.deal.ofCheck(deal.badge);
}

/** Saytdagi `formatKm` (src/lib/geo.ts): "0.4 km", "12 km" */
export function formatKm(km: number): string {
  if (km >= 10) return `${Math.round(km)} km`;
  return `${Math.max(0.1, Math.round(km * 10) / 10).toFixed(1)} km`;
}

/** "Du, Se, Ju" yoki "Har kuni" */
export function formatWeekdays(days: number[]): string {
  if (days.length === 7) return copy.deal.everyDay;
  return [...days].sort((a, b) => a - b).map((d) => copy.weekdaysShort[d - 1]).join(", ");
}

/** "2026-12-31" → "31-dekabrgacha" */
export function formatUntil(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return copy.deal.untilValue(d ?? 1, copy.months[(m ?? 1) - 1] ?? "");
}

/** Bildirishnoma vaqti: "bugun, 14:42" / "12.11, 14:42" (Toshkent vaqtida) */
export function formatWhen(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = clock(iso);
  return daysBetween(at, now) === 0 ? `${copy.student.today}, ${time}` : `${dayMonth(toTashkent(at).date)}, ${time}`;
}

/** Ism-familiyadan bosh harflar */
export const initials = (first?: string | null, last?: string | null) => `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase();

const DAY_MS_WEB = 86_400_000;

/** Saytdagi `useDealText().webStatus`: "23:00 gacha", "Bugun 16:00", "Ertaga 08:00", "Dushanba 09:00", "25.11 dan" */
export function webStatus(deal: { live: boolean; closesAt: string | null; opensAt: string | null }, now: Date): string {
  const w = copy.deal.web;
  if (deal.live && deal.closesAt) return w.until(clock(deal.closesAt));
  if (!deal.opensAt) return "";
  const target = toTashkent(new Date(deal.opensAt));
  const days = Math.round((target.date.getTime() - toTashkent(now).date.getTime()) / DAY_MS_WEB);
  if (days >= 7) return w.fromDate(`${String(target.date.getUTCDate()).padStart(2, "0")}.${String(target.date.getUTCMonth() + 1).padStart(2, "0")}`);
  const label = days <= 0 ? w.today : days === 1 ? w.tomorrow : copy.weekdays[target.weekday - 1]!;
  return `${label} ${clock(deal.opensAt)}`;
}
