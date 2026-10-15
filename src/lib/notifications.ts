import { z } from "zod";
import { fromTashkent, parseMinute, toTashkent } from "./time";

/** Bildirishnoma qoidalari (forma va server bitta): uzunliklar, auditoriya, havola, vaqt. */

export const TITLE_MAX = 50;
export const BODY_MAX = 150;
/** Admin yuboradigan auditoriyalar (USER — tizim xabari, formada yo'q). */
export const AUDIENCES = ["ALL_STUDENTS", "UNIVERSITY", "DISTRICT", "BUSINESSES"] as const;
export type AudienceKey = (typeof AUDIENCES)[number];
export const LINK_TYPES = ["HOME", "CATEGORY", "DISCOUNT"] as const;
/** Rejalashtirish: kelajakda eng ko'pi bilan shuncha kun. */
export const MAX_SCHEDULE_DAYS = 90;
/** Rejalashtirilgan vaqt kamida shuncha daqiqa keyin (aks holda "hozir"). */
export const MIN_SCHEDULE_MINUTES = 2;
const DAY_MS = 86_400_000;

/** Ertaga 08:30 (Toshkent) — dizayndagi "Ertaga 08:30" tugmasi. */
export function defaultSchedule(now: Date): Date {
  return fromTashkent(new Date(toTashkent(now).date.getTime() + DAY_MS), 8 * 60 + 30);
}

/** `<input type="datetime-local">` qiymati ("2026-10-16T08:30", Toshkent vaqti) → UTC lahza. */
export function parseLocalDateTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(value.trim());
  if (!m) return null;
  const minute = parseMinute(m[4]!);
  if (minute == null) return null;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // 2026-02-31 kabi sanalar Date.UTC da keyingi oyga o'tib ketadi — qaytarib tekshiriladi
  if (day.getUTCFullYear() !== Number(m[1]) || day.getUTCMonth() !== Number(m[2]) - 1 || day.getUTCDate() !== Number(m[3])) return null;
  return fromTashkent(day, minute);
}

/** UTC lahza → `datetime-local` qiymati (Toshkent). */
export function toLocalDateTime(instant: Date): string {
  const t = toTashkent(instant);
  const hh = String(Math.floor(t.minute / 60)).padStart(2, "0");
  const mm = String(t.minute % 60).padStart(2, "0");
  return `${t.date.toISOString().slice(0, 10)}T${hh}:${mm}`;
}

export type ScheduleCheck = { ok: true; at: Date; immediate: boolean } | { ok: false; error: "invalid" | "past" | "far" };

/** "Hozir" — darhol; aks holda vaqt kelajakda (kamida 2 daqiqa) va 90 kundan uzoq bo'lmasligi kerak. */
export function checkSchedule(when: "now" | "later", value: string | undefined, now: Date): ScheduleCheck {
  if (when === "now") return { ok: true, at: now, immediate: true };
  const at = value ? parseLocalDateTime(value) : null;
  if (!at) return { ok: false, error: "invalid" };
  if (at.getTime() < now.getTime() + MIN_SCHEDULE_MINUTES * 60_000) return { ok: false, error: "past" };
  if (at.getTime() > now.getTime() + MAX_SCHEDULE_DAYS * DAY_MS) return { ok: false, error: "far" };
  return { ok: true, at, immediate: false };
}

const id = z.string().min(1).max(40);

/** Admin formasi. Auditoriya turiga qarab `audienceIds` majburiy; havola turiga qarab `linkId`. */
export const notificationInput = z
  .object({
    audience: z.enum(AUDIENCES),
    audienceIds: z.array(id).max(100).default([]),
    title: z.string().trim().min(1).max(TITLE_MAX),
    body: z.string().trim().min(1).max(BODY_MAX),
    linkType: z.enum(LINK_TYPES),
    linkId: id.optional(),
    when: z.enum(["now", "later"]),
    scheduledAt: z.string().max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.audience === "UNIVERSITY" || value.audience === "DISTRICT") && value.audienceIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["audienceIds"], message: "audience_empty" });
    }
    if (value.linkType !== "HOME" && !value.linkId) ctx.addIssue({ code: "custom", path: ["linkId"], message: "link_missing" });
  });

export type NotificationInput = z.infer<typeof notificationInput>;

/** Ilova ichidagi manzil: havola turi + rol bosh sahifasi (HOME). */
export function notificationHref(link: { type: "HOME" | "CATEGORY" | "DISCOUNT"; id?: string | null }, home: string): string {
  if (link.type === "DISCOUNT" && link.id) return `/chegirmalar/${encodeURIComponent(link.id)}`;
  if (link.type === "CATEGORY" && link.id) return `/chegirmalar?kategoriya=${encodeURIComponent(link.id)}`;
  return home;
}

/** Push yuklamasi (service worker o'qiydi) — kichik: brauzer chegarasi ~4 KB. */
export type PushPayload = { title: string; body: string; url: string; tag: string };

export function pushPayload(n: { id: string; title: string; body: string }, url: string): string {
  return JSON.stringify({ title: n.title, body: n.body, url, tag: n.id } satisfies PushPayload);
}

/** Matnni `max` belgigacha qisqartiradi (oxirida "…"). */
export function clip(text: string, max: number): string {
  const value = text.trim();
  if (value.length <= max) return value;
  if (max <= 1) return value.slice(0, Math.max(0, max));
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
