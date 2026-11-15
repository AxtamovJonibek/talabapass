import { z } from "zod";
import { filterDeals, SORTS, sortDeals } from "@/lib/feed";
import { ok, readQuery, route } from "@/server/api/http";
import { originQuery, resolveOrigin } from "@/server/api/origin";
import { requireApiStudent } from "@/server/api/session";
import { db } from "@/server/db";
import { feedDeals } from "@/server/student/feed";

/**
 * Lenta (T4 / WT2): talabaga ko'rinadigan chegirmalar (`visibleDiscountWhere`), holati va bugungi qoldig'i bilan.
 * Filtr va saralash saytdagi funksiyalar bilan (`src/lib/feed.ts`); joy berilsa `distanceKm`.
 */
export const GET = route(async (request) => {
  await requireApiStudent(request);
  const q = readQuery(
    request,
    originQuery.extend({
      q: z.string().max(100).default(""),
      category: z.string().max(40).default("all"),
      live: z.enum(["0", "1"]).default("0"),
      sort: z.enum(SORTS).default("near"),
    }),
  );
  const now = new Date();
  const [deals, categories] = await Promise.all([
    feedDeals(now, await resolveOrigin(q)),
    db.category.findMany({ orderBy: { sort: "asc" }, select: { slug: true, name: true, icon: true, tileColor: true, inkColor: true } }),
  ]);
  const names = new Map(categories.map((c) => [c.slug, c.name]));
  const list = sortDeals(filterDeals(deals, { q: q.q, category: q.category, liveOnly: q.live === "1" }, (slug) => names.get(slug) ?? ""), q.sort);
  return ok({ deals: list, categories, now: now.toISOString() });
});
