import { ok, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { ownerChanges } from "@/server/admin/business-ops";

/**
 * Egasining biznesidagi o'zgarishlar jurnali: admin (`by: "admin"`) yoki ega o'zgartirgan maydon, oldin → keyin, vaqt (ISO).
 * `field`: biznes maydoni (`name`, `address` …), `discount_<maydon>`, `discount_created|deleted|duplicated|status`,
 * `sale_voided`, `cashier_added|removed|blocked|unblocked`. Chegirma qiymatlari «nom»: qiymat ko'rinishida. Oxirgi 50 ta.
 */
export const GET = route(async (request) => {
  const { business } = await requireApiOwner(request);
  const changes = await ownerChanges(business.id);
  return ok({ changes: changes.map((c) => ({ ...c, at: c.at.toISOString() })) });
});
