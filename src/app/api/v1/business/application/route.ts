import { ApiError, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { cleanQuickOrThrow, quickApplicationSchema } from "@/server/api/register";
import { requireApiRole } from "@/server/api/session";
import { ownBusiness, type OwnBusiness } from "@/server/business/registration";
import { updateQuickBusiness } from "@/server/business/quick-application";

function view(b: OwnBusiness) {
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    tin: b.tin,
    phone: b.publicPhone,
    telegram: b.telegram,
    status: b.status,
    submittedAt: b.submittedAt?.toISOString() ?? null,
    rejectReason: b.rejectReason,
    /** Egasi o'zgartira oladimi: yuborilmagan yoki rad etilgan */
    editable: (b.status === "PENDING" && b.submittedAt === null) || b.status === "REJECTED",
    hasLogo: b.logoKey !== null,
  };
}

/** Ariza va holati: `PENDING` + `submittedAt: null` — to'ldirilmoqda; `PENDING` + sana — tekshiruvda; `APPROVED` | `WARNED` | `REJECTED` | `BLOCKED`. */
export const GET = route(async (request) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  const business = await ownBusiness(user.id);
  if (!business) throw new ApiError("not_found");
  return ok({ application: view(business) });
});

/** Yuborilmagan yoki rad etilgan arizani tuzatish (keyin yana `submit`). Tekshiruvdagisi — `not_editable`. */
export const PATCH = route(async (request) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  await limit("write", user.id);
  const info = cleanQuickOrThrow(await readJson(request, quickApplicationSchema));
  const updated = await updateQuickBusiness(user.id, info);
  if (!updated.ok) throw new ApiError(updated.error === "tinTaken" ? "tin_taken" : "not_editable");
  return ok({ application: view((await ownBusiness(user.id))!) });
});
