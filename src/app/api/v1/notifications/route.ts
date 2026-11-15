import { ok, route } from "@/server/api/http";
import { requireApiRole } from "@/server/api/session";
import { inboxItems, unreadCount } from "@/server/notifications/inbox";

/** Ilova ichidagi xabarlar (oxirgi 50 ta). `link` — ilova ekrani uchun, `href` — sayt yo'li. */
export const GET = route(async (request) => {
  const { user } = await requireApiRole(request, "STUDENT", "BUSINESS_OWNER");
  const [items, unread] = await Promise.all([inboxItems(user.id, user.role === "STUDENT" ? "/chegirmalar" : "/biznes"), unreadCount(user.id)]);
  return ok({ unread, items: items.map((item) => ({ ...item, at: item.at.toISOString() })) });
});
