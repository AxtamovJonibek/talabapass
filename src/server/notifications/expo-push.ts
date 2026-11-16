import "server-only";
import { db } from "../db";

/**
 * Ilova (Expo) push: `PushDevice` tokenlariga Expo Push API orqali (`exp.host`, FCM/APNs ni Expo o'zi chaqiradi).
 * Kalit shart emas; `EXPO_ACCESS_TOKEN` berilsa (Expo hisobida "push security" yoqilgan bo'lsa) — sarlavhada.
 *
 * Yaroqsiz token (ilova o'chirilgan — `DeviceNotRegistered`) ikki joyda aniqlanadi va bazadan olib tashlanadi: yuborish
 * javobida (ticket) va 15+ daqiqadan keyin Expo kvitansiyasida (receipt; `checkExpoReceipts` — bildirishnomalar cron'i).
 * Har xabarda `badge` — foydalanuvchining o'qilmagan xabarlari (iOS ikonka raqami); buyurtma xabarlari — `orders` kanali.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
/** Expo bitta so'rovda 100 tagacha xabar, 1000 tagacha kvitansiya qabul qiladi */
const CHUNK = 100;
const RECEIPTS_CHUNK = 1000;
/** Kvitansiya shundan keyin tayyor bo'ladi (Expo: ~15 daqiqa) va 24 soatgacha saqlanadi */
const RECEIPT_DELAY_MS = 15 * 60_000;
const RECEIPT_MAX_AGE_MS = 24 * 60 * 60_000;

/** Android kanallari ilovada yaratiladi (`mobile/src/lib/push.ts`) */
export type ExpoChannel = "default" | "orders";
export type ExpoMessage = { title: string; body: string; data?: Record<string, unknown>; channelId?: ExpoChannel };
type Ticket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };
type Receipt = { status: "ok" } | { status: "error"; message?: string; details?: { error?: string } };
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export const isExpoToken = (token: string) => /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/.test(token);

export function expoMessage(to: string, m: ExpoMessage, badge?: number) {
  return {
    to,
    title: m.title,
    body: m.body,
    data: m.data ?? {},
    sound: "default",
    priority: "high",
    channelId: m.channelId ?? "default",
    ...(badge !== undefined ? { badge } : {}),
  };
}

/** Web push yuklamasi (`pushPayload`: title, body, url) → Expo xabari (`url` — ilova qaysi ekranni ochishi uchun). */
export function expoFromWebPayload(payload: string): ExpoMessage | null {
  try {
    const p = JSON.parse(payload) as { title?: unknown; body?: unknown; url?: unknown; tag?: unknown };
    if (typeof p.title !== "string" || typeof p.body !== "string") return null;
    const url = typeof p.url === "string" ? p.url : null;
    return { title: p.title, body: p.body, data: { url, id: typeof p.tag === "string" ? p.tag : null }, channelId: url?.includes("/buyurtmalar") ? "orders" : "default" };
  } catch {
    return null;
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  const access = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (access) h.authorization = `Bearer ${access}`;
  return h;
}

/** Qaytadi: Expo qabul qilgan xabarlar soni. */
export async function sendExpoPush(userIds: string[], message: ExpoMessage, send: Fetch = fetch): Promise<number> {
  if (userIds.length === 0) return 0;
  const devices = (await db.pushDevice.findMany({ where: { userId: { in: userIds } }, select: { id: true, token: true, userId: true } })).filter((d) => isExpoToken(d.token));
  if (devices.length === 0) return 0;
  const unread = await db.userNotification.groupBy({ by: ["userId"], where: { userId: { in: [...new Set(devices.map((d) => d.userId))] }, readAt: null }, _count: { _all: true } });
  const badge = new Map(unread.map((u) => [u.userId, u._count._all]));

  let sent = 0;
  const gone: string[] = [];
  const tickets: { id: string; deviceId: string }[] = [];
  for (let i = 0; i < devices.length; i += CHUNK) {
    const batch = devices.slice(i, i + CHUNK);
    try {
      const body = JSON.stringify(batch.map((d) => expoMessage(d.token, message, badge.get(d.userId) ?? 0)));
      const res = await send(EXPO_PUSH_URL, { method: "POST", headers: headers(), body, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        console.warn("[expo-push] javob:", res.status);
        continue;
      }
      const result = ((await res.json()) as { data?: Ticket[] }).data ?? [];
      result.forEach((ticket, k) => {
        if (ticket.status === "ok") {
          sent++;
          tickets.push({ id: ticket.id, deviceId: batch[k]!.id });
        } else if (ticket.details?.error === "DeviceNotRegistered") gone.push(batch[k]!.id);
        else console.warn("[expo-push] yuborilmadi:", ticket.details?.error ?? ticket.message);
      });
    } catch (error) {
      console.warn("[expo-push] so'rov xatosi:", (error as Error).message);
    }
  }
  if (gone.length) await db.pushDevice.deleteMany({ where: { id: { in: gone } } });
  if (tickets.length) await db.pushTicket.createMany({ data: tickets, skipDuplicates: true });
  return sent;
}

/**
 * Kvitansiyalar (bildirishnomalar cron'idan, 5 daqiqada): 15 daqiqadan eski ticket'lar so'raladi, `DeviceNotRegistered`
 * bo'lgan qurilmalar o'chiriladi, tekshirilgan va 24 soatdan eski ticket'lar tashlanadi. Qaytadi: o'chirilgan qurilmalar.
 */
export async function checkExpoReceipts(now = new Date(), send: Fetch = fetch): Promise<number> {
  await db.pushTicket.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RECEIPT_MAX_AGE_MS) } } });
  const due = await db.pushTicket.findMany({
    where: { createdAt: { lte: new Date(now.getTime() - RECEIPT_DELAY_MS) } },
    orderBy: { createdAt: "asc" },
    take: RECEIPTS_CHUNK,
    select: { id: true, deviceId: true },
  });
  if (due.length === 0) return 0;
  let receipts: Record<string, Receipt>;
  try {
    const res = await send(EXPO_RECEIPTS_URL, { method: "POST", headers: headers(), body: JSON.stringify({ ids: due.map((t) => t.id) }), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn("[expo-push] kvitansiyalar javobi:", res.status);
      return 0;
    }
    receipts = ((await res.json()) as { data?: Record<string, Receipt> }).data ?? {};
  } catch (error) {
    console.warn("[expo-push] kvitansiyalar xatosi:", (error as Error).message);
    return 0;
  }
  const gone = due.filter((t) => {
    const r = receipts[t.id];
    return r?.status === "error" && r.details?.error === "DeviceNotRegistered";
  });
  for (const t of due) {
    const r = receipts[t.id];
    if (r?.status === "error" && r.details?.error !== "DeviceNotRegistered") console.warn("[expo-push] kvitansiya:", r.details?.error ?? r.message);
  }
  const removed = gone.length ? (await db.pushDevice.deleteMany({ where: { id: { in: gone.map((t) => t.deviceId) } } })).count : 0;
  // Javobda yo'q ticket — hali tayyor emas (keyingi safar); bor bo'lgani — tekshirildi
  await db.pushTicket.deleteMany({ where: { id: { in: due.filter((t) => receipts[t.id]).map((t) => t.id) } } });
  return removed;
}
