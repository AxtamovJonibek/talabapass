import { ok, route } from "@/server/api/http";
import { requireApiRole } from "@/server/api/session";
import { markInboxRead } from "@/server/notifications/inbox";

/** Hammasini o'qilgan deb belgilash (admin statistikasidagi "ochildi" shundan). */
export const POST = route(async (request) => {
  const { user } = await requireApiRole(request, "STUDENT", "BUSINESS_OWNER");
  return ok({ marked: await markInboxRead(user.id) });
});
