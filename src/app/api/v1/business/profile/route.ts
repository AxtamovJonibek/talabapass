import { z } from "zod";
import { businessLogoUrl } from "@/lib/profile-image";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { signUrls } from "@/server/api/files";
import { limit } from "@/server/api/rate-limit";
import { ownerProfile } from "@/server/business/profile";
import { permissionsOf } from "@/server/business/permissions";
import { editableInfo, editBusinessInfo } from "@/server/business/profile-edit";
import { db } from "@/server/db";

/**
 * Biznes profili (B5): ma'lumotlar, talabaga ko'rinadigan aloqa (telefon, Telegram, Instagram), logotip (imzoli),
 * bugungi sotuvlar va faol chegirmalar, oldindan buyurtma yoqilganmi (menyuda "Buyurtmalar"), admin ruxsatlari (`permissions`).
 */
export const GET = route(async (request) => {
  const { user, business } = await requireApiOwner(request);
  const [info, summary, preorder, permissions] = await Promise.all([
    editableInfo(user.id),
    ownerProfile(user.id),
    db.preorderSettings.findUnique({ where: { businessId: business.id }, select: { enabled: true } }),
    permissionsOf(business.id),
  ]);
  if (!info || !summary) throw new ApiError("business_not_ready");
  const { logoKey, ...rest } = info;
  return ok(
    signUrls({
      profile: {
        ...rest,
        kind: summary.kind,
        typeLabel: summary.typeLabel,
        district: summary.district?.name ?? null,
        logoUrl: businessLogoUrl(info.id, logoKey),
        salesToday: summary.salesToday,
        revenueToday: summary.revenueToday,
        activeDiscounts: summary.activeDiscounts,
        preorderEnabled: preorder?.enabled ?? false,
        // Admin ruxsatlari: ilova cheklangan amallarni oldindan ko'rsatadi (server baribir tekshiradi)
        permissions,
      },
    }),
  );
});

const editInput = z.object({
  name: z.string().max(400),
  address: z.string().max(400),
  workingHours: z.string().max(400),
  description: z.string().max(400),
  landmark: z.string().max(400).optional(),
  phone: z.string().max(400).optional(),
  telegram: z.string().max(400).optional(),
  instagram: z.string().max(400).optional(),
});

/**
 * Tahrirlash (saytdagi `/biznes/profil/tahrir`): nom yoki manzil o'zgarsa biznes qayta tekshiruvga tushadi
 * (`rereview: true` — chegirmalar talabaga ko'rinmay qoladi); ish vaqti, tavsif, mo'ljal va aloqa — tekshiruvsiz.
 * Aloqa maydoni berilmasa — o'zgarmaydi, bo'sh qator — o'chadi.
 */
export const PATCH = route(async (request) => {
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  const result = await editBusinessInfo(user.id, await readJson(request, editInput));
  if (!result.ok)
    throw "fields" in result ? new ApiError("invalid_request", { fields: result.fields }) : new ApiError(result.error === "noPermission" ? "permission_denied" : "not_editable");
  return ok({ ok: true, rereview: result.rereview });
});
