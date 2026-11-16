import { z } from "zod";
import { normalizePhone } from "@/lib/format";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { limit } from "@/server/api/rate-limit";
import { invitePhone, ownerCashiers } from "@/server/business/cashiers";

/** Kassirlar (B5): faollari (bugungi skanlar, "Smenada") va ochiq takliflar (`phone` — ilovadan qo'shilgani). */
export const GET = route(async (request) => {
  const { user } = await requireApiOwner(request);
  const data = await ownerCashiers(user.id);
  return ok({ ...data, invites: data.invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })) });
});

/**
 * Kassir qo'shish — telefon raqami bilan taklif (48 soat). Kassir ilovaga shu raqam bilan kirib (SMS kod, "Biznes")
 * o'zi qabul qiladi. Raqam boshqa hisobniki bo'lsa ham javob bir xil (raqam bor-yo'qligi oshkor qilinmaydi).
 */
export const POST = route(async (request) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const { phone: raw } = await readJson(request, z.object({ phone: z.string().max(32) }));
  const phone = normalizePhone(raw);
  if (!phone) throw new ApiError("invalid_phone");
  const result = await invitePhone(user.id, phone);
  if (!result.ok) throw new ApiError(result.error === "tooMany" ? "too_many_invites" : result.error === "alreadyCashier" ? "already_cashier" : "business_not_ready");
  return ok({ invite: { id: result.inviteId, phone, expiresAt: result.expiresAt.toISOString() } }, 201);
});
