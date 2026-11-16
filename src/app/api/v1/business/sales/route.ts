import { z } from "zod";
import { ok, readQuery, route } from "@/server/api/http";
import { requireApiScanner } from "@/server/api/business";
import { businessSales } from "@/server/business/sales";
import { db } from "@/server/db";

const query = z.object({
  period: z.enum(["1", "7", "30"]).default("1"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  cashier: z.string().regex(/^[a-z0-9_]{10,40}$/).optional(),
});

/**
 * Sotuvlar (saytdagi `/biznes/sotuvlar`): davr, sahifa (25 tadan), jami. Egasi — hammasi yoki `cashier` bo'yicha
 * (`staff` — filtr ro'yxati); kassir — **faqat o'zi tasdiqlaganlari** (`cashier` e'tiborsiz).
 */
export const GET = route(async (request) => {
  const { user, scanner } = await requireApiScanner(request);
  const q = readQuery(request, query);
  const owner = user.role === "BUSINESS_OWNER";
  const cashierId = owner ? q.cashier : user.id;
  const sales = await businessSales(scanner.businessId, Number(q.period) as 1 | 7 | 30, q.page, new Date(), cashierId);
  const staff = owner
    ? (
        await db.businessMember.findMany({
          where: { businessId: scanner.businessId, OR: [{ role: "OWNER" }, { role: "CASHIER", active: true }] },
          orderBy: { createdAt: "asc" },
          select: { role: true, user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        })
      ).map((m) => ({ id: m.user.id, name: [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.phone, owner: m.role === "OWNER" }))
    : null;
  return ok({ ...sales, rows: sales.rows.map((r) => ({ ...r, at: r.at.toISOString() })), staff });
});
