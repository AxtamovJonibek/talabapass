import "server-only";
import { db } from "../db";

/**
 * Ilova (Expo) push: `PushDevice` tokenlariga Expo Push API orqali (`exp.host`, FCM/APNs ni Expo o'zi chaqiradi).
 * Kalit shart emas; `EXPO_ACCESS_TOKEN` berilsa (Expo hisobida "push security" yoqilgan bo'lsa) — sarlavhada.
 * Qurilmada ilova o'chirilgan (`DeviceNotRegistered`) — token bazadan olib tashlanadi. Xato boshqa qurilmaga ta'sir qilmaydi.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo bitta so'rovda 100 tagacha xabar qabul qiladi */
const CHUNK = 100;

export type ExpoMessage = { title: string; body: string; data?: Record<string, unknown> };
type Ticket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export const isExpoToken = (token: string) => /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/.test(token);

export function expoPayload(tokens: string[], m: ExpoMessage) {
  return tokens.map((to) => ({ to, title: m.title, body: m.body, data: m.data ?? {}, sound: "default", priority: "high", channelId: "default" }));
}

/** Web push yuklamasi (`pushPayload`: title, body, url) → Expo xabari (`url` — ilova qaysi ekranni ochishi uchun). */
export function expoFromWebPayload(payload: string): ExpoMessage | null {
  try {
    const p = JSON.parse(payload) as { title?: unknown; body?: unknown; url?: unknown; tag?: unknown };
    if (typeof p.title !== "string" || typeof p.body !== "string") return null;
    return { title: p.title, body: p.body, data: { url: typeof p.url === "string" ? p.url : null, id: typeof p.tag === "string" ? p.tag : null } };
  } catch {
    return null;
  }
}

/** Qaytadi: Expo qabul qilgan xabarlar soni. */
export async function sendExpoPush(userIds: string[], message: ExpoMessage, send: Fetch = fetch): Promise<number> {
  if (userIds.length === 0) return 0;
  const devices = (await db.pushDevice.findMany({ where: { userId: { in: userIds } }, select: { id: true, token: true } })).filter((d) => isExpoToken(d.token));
  let sent = 0;
  const gone: string[] = [];
  for (let i = 0; i < devices.length; i += CHUNK) {
    const batch = devices.slice(i, i + CHUNK);
    try {
      const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
      const access = process.env.EXPO_ACCESS_TOKEN?.trim();
      if (access) headers.authorization = `Bearer ${access}`;
      const res = await send(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(expoPayload(batch.map((d) => d.token), message)), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        console.warn("[expo-push] javob:", res.status);
        continue;
      }
      const tickets = ((await res.json()) as { data?: Ticket[] }).data ?? [];
      tickets.forEach((ticket, k) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") gone.push(batch[k]!.id);
        else console.warn("[expo-push] yuborilmadi:", ticket.details?.error ?? ticket.message);
      });
    } catch (error) {
      console.warn("[expo-push] so'rov xatosi:", (error as Error).message);
    }
  }
  if (gone.length) await db.pushDevice.deleteMany({ where: { id: { in: gone } } });
  return sent;
}
