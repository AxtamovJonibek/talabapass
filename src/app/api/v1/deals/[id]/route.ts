import { ApiError, idParam, ok, readQuery, route } from "@/server/api/http";
import { originQuery, resolveOrigin } from "@/server/api/origin";
import { requireApiStudent } from "@/server/api/session";
import { activeCouponFor } from "@/server/coupons/coupons";
import { countView, dealDetail, isSaved } from "@/server/student/feed";

/** Chegirma tafsiloti (T5 / WT3) + saqlanganmi + shu chegirmadagi faol kupon (QR uchun). Ochilishi ko'rish sifatida sanaladi (B6 voronkasi). */
export const GET = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiStudent(request);
  const id = await idParam(ctx);
  const now = new Date();
  const detail = await dealDetail(id, now, await resolveOrigin(readQuery(request, originQuery)));
  if (!detail) throw new ApiError("not_found");
  const [saved, coupon] = await Promise.all([isSaved(user.id, id), activeCouponFor(user.id, id), countView(id, now)]);
  return ok({ ...detail, saved, coupon });
});
