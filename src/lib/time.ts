/**
 * Toshkent vaqti: UTC+5, yozgi vaqtga o'tish yo'q — shuning uchun siljish doimiy.
 * Chegirma kunlari, soatlari va kunlik limitlar shu vaqtda hisoblanadi.
 */
const OFFSET_MS = 5 * 60 * 60 * 1000;

export type TashkentTime = {
  /** Toshkent kalendar sanasi, UTC yarim tun sifatida — Prisma @db.Date ustunlariga mos */
  date: Date;
  /** 1 = dushanba … 7 = yakshanba */
  weekday: number;
  /** Kun boshidan o'tgan daqiqalar: 14:31 → 871 */
  minute: number;
};

export function toTashkent(instant: Date): TashkentTime {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  const date = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  return {
    date,
    weekday: shifted.getUTCDay() === 0 ? 7 : shifted.getUTCDay(),
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Toshkent sanasi va daqiqasidan UTC lahza. */
export function fromTashkent(date: Date, minute = 0): Date {
  return new Date(date.getTime() + minute * 60_000 - OFFSET_MS);
}

/** 720 → "12:00" */
export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "12:00" → 720; noto'g'ri bo'lsa null */
export function parseMinute(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

export type Schedule = {
  weekdays: number[];
  fromMinute: number;
  toMinute: number;
  startsOn: Date;
  endsOn: Date;
};

/** Oraliq yarim tundan o'tadimi (22:00–02:00 kabi). */
export const crossesMidnight = (s: Pick<Schedule, "fromMinute" | "toMinute">) => s.toMinute <= s.fromMinute;

const DAY_MS = 86_400_000;

/**
 * Shu lahzada ochiq bo'lgan oraliq qaysi kuni boshlangan (Toshkent sanasi) — ochiq bo'lmasa null.
 * Haftaning kuni va muddat (startsOn–endsOn) oraliq BOSHLANGAN kunga qarab tekshiriladi:
 * dushanba 23:00 da boshlangan oraliq seshanba 01:00 da ham amal qiladi, hatto seshanba ro'yxatda bo'lmasa ham.
 * Kunlik limit ham shu sanaga yoziladi.
 */
export function openWindowStart(schedule: Schedule, instant: Date): Date | null {
  const now = toTashkent(instant);
  const startedOn = (date: Date, weekday: number) =>
    date >= schedule.startsOn && date <= schedule.endsOn && schedule.weekdays.includes(weekday) ? date : null;

  if (!crossesMidnight(schedule)) {
    return now.minute >= schedule.fromMinute && now.minute < schedule.toMinute ? startedOn(now.date, now.weekday) : null;
  }
  // Kechki qism: bugun boshlangan oraliq
  if (now.minute >= schedule.fromMinute) return startedOn(now.date, now.weekday);
  // Tungi qism: kecha boshlangan oraliqning davomi
  if (now.minute < schedule.toMinute) return startedOn(new Date(now.date.getTime() - DAY_MS), now.weekday === 1 ? 7 : now.weekday - 1);
  return null;
}

/** Chegirma shu lahzada ochiqmi (kun, soat va muddat bo'yicha; yarim tundan o'tadigan oraliqlar ham). */
export function isOpenAt(schedule: Schedule, instant: Date): boolean {
  return openWindowStart(schedule, instant) !== null;
}
