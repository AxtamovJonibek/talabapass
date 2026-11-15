import { z } from "zod";
import { OTHER_UNIVERSITY, searchUniversities } from "@/lib/universities";
import { ok, readQuery, route } from "@/server/api/http";
import { db } from "@/server/db";

/**
 * Ro'yxat formasi uchun OTM'lar (faol, tizim yozuvisiz). Kirishsiz — ro'yxat paytida hali token yo'q.
 * Ro'yxatda yo'q bo'lsa: `universityId = otherId` va `universityOther` — nomi (admin keyin qo'shadi).
 */
export const GET = route(async (request) => {
  const { q } = readQuery(request, z.object({ q: z.string().max(100).default("") }));
  const list = await db.university.findMany({
    where: { active: true, kind: { not: "OTHER" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortName: true, region: true, kind: true },
  });
  return ok({ universities: searchUniversities(list, q), otherId: OTHER_UNIVERSITY });
});
