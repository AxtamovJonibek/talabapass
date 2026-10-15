import "server-only";
import webpush from "web-push";
import { db } from "../db";

/**
 * Web Push (VAPID). Kalitlar yo'q bo'lsa push o'chiq — ilova ichidagi xabarlar baribir ishlaydi.
 * Yaratish: `npm run push:keys`. Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
 */
const BATCH = 25;

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export function vapidConfig(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/** Brauzerga beriladigan ochiq kalit (yo'q bo'lsa — push tugmasi chiqmaydi). */
export const vapidPublicKey = () => vapidConfig()?.publicKey ?? null;

let configured = false;
function client() {
  const config = vapidConfig();
  if (!config) return null;
  if (!configured) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configured = true;
  }
  return webpush;
}

/** 404/410 — obuna o'lgan (brauzerda o'chirilgan): bazadan olib tashlanadi. */
const isGone = (error: unknown) => {
  const status = (error as { statusCode?: number }).statusCode;
  return status === 404 || status === 410;
};

/**
 * Berilgan foydalanuvchilarning barcha qurilmalariga bir xil yuklamani yuboradi. Xato bitta qurilmada boshqasiga
 * ta'sir qilmaydi. Qaytadi: muvaffaqiyatli yuborilganlar soni.
 */
export async function sendPushToUsers(userIds: string[], payload: string): Promise<number> {
  const sender = client();
  if (!sender || userIds.length === 0) return 0;
  let sent = 0;
  for (let i = 0; i < userIds.length; i += 500) {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId: { in: userIds.slice(i, i + 500) } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    const gone: string[] = [];
    for (let j = 0; j < subscriptions.length; j += BATCH) {
      const batch = subscriptions.slice(j, j + BATCH);
      const results = await Promise.allSettled(
        batch.map((s) => sender.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 60 * 60, urgency: "normal" })),
      );
      results.forEach((result, k) => {
        if (result.status === "fulfilled") sent++;
        else if (isGone(result.reason)) gone.push(batch[k]!.id);
        else console.warn("[push] yuborilmadi:", (result.reason as Error).message);
      });
    }
    if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  }
  return sent;
}
