import { z } from "zod";
import { ok, readJson, route } from "@/server/api/http";
import { requireApiRole } from "@/server/api/session";
import { markInboxRead } from "@/server/notifications/inbox";

/** O'qilgan deb belgilash: tana bo'sh — hammasi, `{ ids }` — faqat shular (admin statistikasidagi "ochildi" shundan). */
export const POST = route(async (request) => {
  const { user } = await requireApiRole(request, "STUDENT", "BUSINESS_OWNER");
  const { ids } = await readJson(request, z.object({ ids: z.array(z.string().regex(/^[a-z0-9]{10,40}$/)).min(1).max(100).optional() }));
  return ok({ marked: await markInboxRead(user.id, ids) });
});
