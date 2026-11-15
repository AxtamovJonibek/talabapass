import { ok, readQuery, route } from "@/server/api/http";
import { originQuery, resolveOrigin } from "@/server/api/origin";
import { requireApiStudent } from "@/server/api/session";
import { savedDeals } from "@/server/student/feed";

/** Saqlangan chegirmalar (hozir ko'rinadiganlari), oxirgi saqlangani oldin. */
export const GET = route(async (request) => {
  const { user } = await requireApiStudent(request);
  return ok({ deals: await savedDeals(user.id, new Date(), await resolveOrigin(readQuery(request, originQuery))) });
});
