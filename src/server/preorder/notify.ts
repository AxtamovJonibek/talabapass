import "server-only";
import { createTranslator } from "next-intl";
import messages from "../../../messages/uz.json";
import type { OrderActor, OrderStatus } from "@/lib/preorder";
import { BODY_MAX, clip, pushPayload, TITLE_MAX } from "@/lib/notifications";
import { formatMinute, toTashkent } from "@/lib/time";
import { db } from "../db";
import { sendPushToUsers } from "../notifications/push";
import { sendTelegram } from "../notifications/telegram";

/**
 * Buyurtma holati o'zgarganda talabaga va biznes egasiga: ilova ichi xabari + push + Telegram (bog'langan bo'lsa).
 * O'zgarishni qilgan tomon o'ziga xabar olmaydi; tizim o'zgarishlari — ikkalasiga. Xato holatni bekor qilmaydi.
 */
type Target = "student" | "business";

/**
 * Kimga yuboriladi. O'zi qilgan o'zgarish haqida xabar kerak emas; biznes to'lanmagan buyurtmani umuman ko'rmagan —
 * uning bekor bo'lishi ham biznesga bormaydi; avtomatik tasdiq — faqat talabaga (biznes "Yangi buyurtma" olgan).
 */
export function recipientsFor(from: OrderStatus, to: OrderStatus, by: OrderActor): Target[] {
  if (to === "PENDING_PAYMENT") return [];
  if (to === "PAID") return ["business"];
  if (from === "PENDING_PAYMENT") return by === "student" ? [] : ["student"];
  if (by === "student") return ["business"];
  if (by === "business" || by === "cashier") return ["student"];
  if (to === "CONFIRMED") return ["student"];
  return ["student", "business"];
}

export async function notifyOrder(orderId: string, from: OrderStatus, to: OrderStatus, by: OrderActor, actorId: string | null): Promise<void> {
  try {
    const targets = recipientsFor(from, to, by);
    if (targets.length === 0) return;
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        title: true,
        quantity: true,
        slotStart: true,
        rejectReason: true,
        studentId: true,
        student: { select: { firstName: true, telegramChatId: true, status: true } },
        business: { select: { name: true, ownerId: true, owner: { select: { telegramChatId: true, status: true } } } },
      },
    });
    if (!order) return;
    const t = createTranslator({ locale: "uz", messages, namespace: "orders.notify" });
    const slot = toTashkent(order.slotStart);
    const params = {
      title: order.title,
      business: order.business.name,
      student: order.student.firstName ?? "",
      n: order.quantity,
      time: formatMinute(slot.minute),
      reason: order.rejectReason ?? "",
    };
    const now = new Date();

    for (const target of targets) {
      const userId = target === "student" ? order.studentId : order.business.ownerId;
      const user = target === "student" ? order.student : order.business.owner;
      if (user.status !== "ACTIVE") continue;
      const title = clip(t(`${target}.${to}.title`, params), TITLE_MAX);
      const body = clip(t(`${target}.${to}.body`, params), BODY_MAX);
      const href = target === "student" ? `/buyurtmalar/${order.id}` : `/biznes/buyurtmalar`;
      const notification = await db.notification.create({
        data: {
          title,
          body,
          audience: "USER",
          audienceIds: [userId],
          linkType: "HOME",
          scheduledAt: now,
          sentAt: now,
          status: "SENT",
          delivered: 1,
          createdById: actorId ?? userId,
          recipients: { create: { userId } },
        },
        select: { id: true, title: true, body: true },
      });
      await Promise.allSettled([
        sendPushToUsers([userId], pushPayload(notification, href)),
        user.telegramChatId ? sendTelegram(user.telegramChatId, `${title}\n${body}`) : Promise.resolve(false),
      ]);
    }
  } catch (error) {
    console.error("[notifyOrder] xabar yuborilmadi:", orderId, to, error);
  }
}
