import "server-only";
import { notificationHref } from "@/lib/notifications";
import { db } from "../db";

/** Ilova ichidagi xabarlar qutisi (talaba va biznes egasi uchun bir xil). Faqat o'z xabarlari — `userId` sessiyadan. */

const INBOX_LIMIT = 50;

export async function inboxItems(userId: string, home: string) {
  const rows = await db.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: INBOX_LIMIT,
    select: { id: true, readAt: true, createdAt: true, notification: { select: { title: true, body: true, linkType: true, linkId: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.notification.title,
    body: r.notification.body,
    at: r.createdAt,
    unread: r.readAt === null,
    href: notificationHref({ type: r.notification.linkType, id: r.notification.linkId }, home),
  }));
}

export async function markInboxRead(userId: string): Promise<number> {
  const result = await db.userNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return result.count;
}

export const unreadCount = (userId: string) => db.userNotification.count({ where: { userId, readAt: null } });
