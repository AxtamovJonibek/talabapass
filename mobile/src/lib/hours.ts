import { formatMinute } from "./format";

/** "12:00" → 720 (saytdagi `src/lib/time.ts` `parseMinute` bilan bir xil) */
function parseMinute(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/*
 * Vaqt tanlash — saytdagi `src/lib/hours.ts` ning NUSXASI (birini o'zgartirsangiz ikkinchisini ham; testlar saytda: hours.test.ts).
 * Bazaga yoziladigan matn doim o'zbekcha belgilar bilan (`UZ_HOURS_LABELS`, `ui/time-pickers.tsx`) — sayt uni qayta o'qiydi.
 * Kiritish usuli o'zgardi, saqlash va mavjud qoidalar o'zgarmagan:
 * - chegirma — `weekdays` + `fromMinute`/`toMinute` (`validateDiscount`, `dealTiming`);
 * - biznes ish vaqti — `Business.workingHours` matni. Tanlovdan yig'ilgan matn qayta o'qiladi (`parseSchedule`), shuning uchun
 *   forma keyingi ochilishda jadvalni tiklaydi; eski erkin matn ("09:00 – 22:00") ham imkon qadar o'qiladi.
 * Kun: 1 — Dushanba … 7 — Yakshanba. Daqiqa — Toshkent vaqti. `to <= from` — yarim tundan o'tadi (22:00–02:00).
 */

export const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const TIME_STEP = 30;
/** "Kun bo'yi" — 00:00–23:59 (`validateDiscount`: 00:00–24:00 bir xil vaqt deb rad etiladi) */
export const ALL_DAY = { from: 0, to: 1439 } as const;

export type Range = { from: number; to: number };
export type DayHours = Range & { day: number };
/** Faqat ochiq kunlar (yo'q kun — dam olish) */
export type WeekSchedule = DayHours[];

export const DAY_PRESETS = {
  everyDay: [1, 2, 3, 4, 5, 6, 7],
  workdays: [1, 2, 3, 4, 5],
  weekend: [6, 7],
} as const;
export type DayPreset = keyof typeof DAY_PRESETS;

/** Tayyor oraliqlar. "Ish vaqti bo'yicha" — biznes jadvalidan (`hoursFor`), shu yerda yo'q. */
export const TIME_PRESETS = {
  morning: { from: 8 * 60, to: 12 * 60 },
  lunch: { from: 12 * 60, to: 15 * 60 },
  evening: { from: 18 * 60, to: 22 * 60 },
  allDay: ALL_DAY,
} as const;
export type TimePreset = keyof typeof TIME_PRESETS;

const sortedDays = (days: Iterable<number>) => [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);

/** Tanlangan kunlar tayyor tanlovga to'g'ri kelsa — uning nomi */
export function dayPresetOf(days: readonly number[]): DayPreset | null {
  const key = sortedDays(days).join(",");
  return (Object.keys(DAY_PRESETS) as DayPreset[]).find((p) => DAY_PRESETS[p].join(",") === key) ?? null;
}

export const sameRange = (a: Range, b: Range) => a.from === b.from && a.to === b.to;

export function timePresetOf(range: Range): TimePreset | null {
  return (Object.keys(TIME_PRESETS) as TimePreset[]).find((p) => sameRange(TIME_PRESETS[p], range)) ?? null;
}

/**
 * Ochiladigan ro'yxat qiymatlari: 00:00 dan 23:30 gacha 30 daqiqa qadam; "gacha" ro'yxatida oxirida 23:59.
 * Joriy qiymat qadamga tushmasa (eski chegirma, "Kun bo'yi") — u ham qo'shiladi.
 */
export function timeOptions(kind: "from" | "to", current?: number | null): number[] {
  const list: number[] = [];
  for (let m = 0; m < 1440; m += TIME_STEP) list.push(m);
  if (kind === "to") list.push(ALL_DAY.to);
  if (current != null && current >= 0 && current <= 1440 && !list.includes(current)) list.push(current);
  return list.sort((a, b) => a - b);
}

export const overnight = (r: Range) => r.to <= r.from;

/** Oraliq bir kundagi daqiqalar to'plami sifatida: [from, to) bo'laklari, yarim tundan o'tsa ikkiga bo'linadi. */
function pieces(day: number, r: Range): { day: number; from: number; to: number }[] {
  if (!overnight(r)) return [{ day, from: r.from, to: r.to }];
  return [
    { day, from: r.from, to: 1440 },
    { day: (day % 7) + 1, from: 0, to: r.to },
  ];
}

/** Bir hafta oralig'i ikkinchisini (ish vaqti) to'liq qoplaydimi — kunlar bo'yicha, yarim tundan o'tish bilan. */
function covered(inner: { day: number; from: number; to: number }, outer: WeekSchedule): boolean {
  const spans = outer.flatMap((h) => pieces(h.day, h)).filter((p) => p.day === inner.day);
  // Bo'laklarni birlashtirib, inner to'liq ichida ekanini tekshiramiz
  let cursor = inner.from;
  for (const p of spans.sort((a, b) => a.from - b.from)) {
    if (p.from <= cursor && p.to > cursor) cursor = p.to;
    if (cursor >= inner.to) return true;
  }
  return cursor >= inner.to;
}

/**
 * Chegirma vaqti ish vaqtidan chiqadigan kunlar: dam olish kuni yoki soat ish vaqtidan tashqarida.
 * Ish vaqti noma'lum (bo'sh jadval) — tekshirilmaydi.
 */
export function outsideHours(weekdays: readonly number[], range: Range, schedule: WeekSchedule): number[] {
  if (schedule.length === 0) return [];
  return sortedDays(weekdays).filter((day) => pieces(day, range).some((p) => !covered(p, schedule)));
}

/** "Ish vaqti bo'yicha": tanlangan kunlardagi ish vaqti (birinchi ochiq kun); kun tanlanmagan bo'lsa — jadvaldagi birinchisi. */
export function hoursFor(weekdays: readonly number[], schedule: WeekSchedule): Range | null {
  const days = sortedDays(weekdays);
  const hit = schedule.find((h) => days.includes(h.day)) ?? schedule[0];
  return hit ? { from: hit.from, to: hit.to } : null;
}

// ───────── jadval matni (Business.workingHours) ─────────

export type HoursLabels = {
  /** 1..7 → "Du" … "Ya" */
  short: (day: number) => string;
  /** "Har kuni" */
  everyDay: string;
};

const DASH = "–";
const rangeText = (r: Range) => `${formatMinute(r.from)}${DASH}${formatMinute(r.to)}`;

/** Kunlar ro'yxati qisqa ko'rinishda: [1..5] → "Du–Ju", [1,3] → "Du, Ch", [1,2,3,5] → "Du–Ch, Ju" */
export function daysText(days: readonly number[], labels: HoursLabels): string {
  const list = sortedDays(days);
  if (list.length === 7) return labels.everyDay;
  const runs: number[][] = [];
  for (const d of list) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === d - 1) last.push(d);
    else runs.push([d]);
  }
  return runs
    .map((run) => (run.length >= 3 ? `${labels.short(run[0]!)}${DASH}${labels.short(run[run.length - 1]!)}` : run.map(labels.short).join(", ")))
    .join(", ");
}

/**
 * Jadval → qisqa matn (talabaga ko'rinadi va bazaga yoziladi): "Har kuni · 09:00–21:00", "Du–Ju 09:00–18:00; Sh 10:00–16:00".
 * Bir xil soatli kunlar bitta guruhda; dam olish kunlari yozilmaydi.
 */
export function formatSchedule(schedule: WeekSchedule, labels: HoursLabels): string {
  const groups: { range: Range; days: number[] }[] = [];
  for (const h of [...schedule].sort((a, b) => a.day - b.day)) {
    const g = groups.find((x) => sameRange(x.range, h));
    if (g) g.days.push(h.day);
    else groups.push({ range: { from: h.from, to: h.to }, days: [h.day] });
  }
  if (groups.length === 1 && groups[0]!.days.length === 7) return `${labels.everyDay} · ${rangeText(groups[0]!.range)}`;
  return groups.map((g) => `${daysText(g.days, labels)} ${rangeText(g.range)}`).join("; ");
}

const TIME_RE = /(\d{1,2}[:.]\d{2})\s*[–—-]\s*(\d{1,2}[:.]\d{2})\s*$/;

/**
 * Matn → jadval (`formatSchedule` ning teskarisi). Eski erkin matn: faqat oraliq ("09:00 – 22:00") — har kuni.
 * Tanilmasa — null (forma bo'sh jadval bilan ochiladi).
 */
export function parseSchedule(text: string, labels: HoursLabels): WeekSchedule | null {
  const names = new Map(DAYS.map((d) => [labels.short(d).toLowerCase(), d]));
  const out = new Map<number, Range>();
  for (const raw of text.split(";")) {
    const part = raw.trim();
    if (!part) continue;
    const m = TIME_RE.exec(part);
    if (!m) return null;
    const from = parseMinute(m[1]!.replace(".", ":"));
    const to = parseMinute(m[2]!.replace(".", ":"));
    if (from === null || to === null || from === to) return null;
    const head = part.slice(0, m.index).replace(/[·:,\s]+$/, "").trim();
    let days: number[];
    if (!head || head.toLowerCase() === labels.everyDay.toLowerCase()) days = [...DAYS];
    else {
      days = [];
      for (const token of head.split(",")) {
        const [a, b] = token.split(/[–—-]/).map((s) => names.get(s.trim().toLowerCase()));
        if (!a || (token.match(/[–—-]/) && !b)) return null;
        if (b) for (let d = a; ; d = (d % 7) + 1) {
          days.push(d);
          if (d === b) break;
        }
        else days.push(a);
      }
    }
    for (const d of days) out.set(d, { from, to: to === 1440 ? 1440 : to });
  }
  if (out.size === 0) return null;
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([day, r]) => ({ day, ...r }));
}

/** Hamma ochiq kunda soat bir xilmi ("Har kuni bir xil" kaliti) */
export const uniformHours = (schedule: WeekSchedule) => schedule.every((h) => sameRange(h, schedule[0]!));

/** Kunlar va bitta oraliqdan jadval */
export const scheduleOf = (days: readonly number[], range: Range): WeekSchedule => sortedDays(days).map((day) => ({ day, from: range.from, to: range.to }));
