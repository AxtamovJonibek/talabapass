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

/** Chegirma shu lahzada ochiqmi (kun, soat va muddat bo'yicha). */
export function isOpenAt(schedule: Schedule, instant: Date): boolean {
  const now = toTashkent(instant);
  return (
    now.date >= schedule.startsOn &&
    now.date <= schedule.endsOn &&
    schedule.weekdays.includes(now.weekday) &&
    now.minute >= schedule.fromMinute &&
    now.minute < schedule.toMinute
  );
}
