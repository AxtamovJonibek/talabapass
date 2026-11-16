import { ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { saveDiscountInput, savedOrThrow } from "@/server/api/discounts";
import { signUrls } from "@/server/api/files";
import { limit } from "@/server/api/rate-limit";
import { db } from "@/server/db";
import { ownerDiscounts, saveDiscount } from "@/server/business/discounts";
import { discountImageUrl } from "@/lib/feed";

/** Egasining chegirmalari (B5 ro'yxati): holat, rad etish sababi, bugun sotilgani, birinchi rasm. Faollari oldin. */
export const GET = route(async (request) => {
  const { user } = await requireApiOwner(request);
  const discounts = await ownerDiscounts(user.id);
  const images = await db.discountImage.findMany({ where: { discountId: { in: discounts.map((d) => d.id) } }, orderBy: { sort: "asc" }, select: { id: true, discountId: true } });
  const first = new Map<string, string>();
  for (const image of images) if (!first.has(image.discountId)) first.set(image.discountId, discountImageUrl(image.id));
  return ok(signUrls({ discounts: discounts.map((d) => ({ ...d, image: first.get(d.id) ?? null })) }));
});

/**
 * Yangi chegirma (B2 / WB2): `{ draft, intent }`. "E'lon qilish" → `PENDING_REVIEW` (admin tekshiradi), "Qoralama" → `DRAFT`.
 * Qoidalar saytdagi `validateDiscount` (xato — `invalid_request` + `problems`). Rasmlar saqlangandan keyin yuklanadi.
 */
export const POST = route(async (request) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const { draft, intent } = await readJson(request, saveDiscountInput);
  return ok(savedOrThrow(await saveDiscount(user.id, null, draft, intent)), 201);
});
