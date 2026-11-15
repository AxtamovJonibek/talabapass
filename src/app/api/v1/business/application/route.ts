import { ApiError, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { businessInfoSchema, cleanInfoOrThrow } from "@/server/api/register";
import { requireApiRole } from "@/server/api/session";
import { ownBusiness, updateBusinessInfo, type OwnBusiness } from "@/server/business/registration";

function view(b: OwnBusiness) {
  return {
    id: b.id,
    name: b.name,
    kind: b.kind,
    address: b.address,
    workingHours: b.workingHours,
    description: b.description,
    tin: b.tin,
    contactName: b.contactName,
    status: b.status,
    submittedAt: b.submittedAt?.toISOString() ?? null,
    rejectReason: b.rejectReason,
    /** Egasi o'zgartira oladimi: yuborilmagan yoki rad etilgan */
    editable: (b.status === "PENDING" && b.submittedAt === null) || b.status === "REJECTED",
    hasLogo: b.logoKey !== null,
    documents: b.docs.map((d) => ({ id: d.id, kind: d.kind, fileName: d.fileName })),
  };
}

/** Ariza va holati: `PENDING` + `submittedAt: null` — to'ldirilmoqda; `PENDING` + sana — tekshiruvda; `APPROVED` | `WARNED` | `REJECTED` | `BLOCKED`. */
export const GET = route(async (request) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  const business = await ownBusiness(user.id);
  if (!business) throw new ApiError("not_found");
  return ok({ application: view(business) });
});

/** Yuborilmagan yoki rad etilgan arizani tuzatish (barcha matn maydonlari). Tekshiruvdagisi — `not_editable`. */
export const PATCH = route(async (request) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  await limit("write", user.id);
  const info = cleanInfoOrThrow(await readJson(request, businessInfoSchema));
  const updated = await updateBusinessInfo(user.id, info);
  if (!updated.ok) throw new ApiError(updated.error === "tinTaken" ? "tin_taken" : "not_editable");
  return ok({ application: view((await ownBusiness(user.id))!) });
});
