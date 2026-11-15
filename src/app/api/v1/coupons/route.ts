import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { requireApiStudent } from "@/server/api/session";
import { activeCoupons, claimCoupon, studentCoupon, type ClaimError } from "@/server/coupons/coupons";

const CLAIM_ERRORS = {
  notAvailable: "deal_not_available",
  closed: "deal_closed",
  soldOut: "sold_out",
  limit: "coupon_limit",
  notStudent: "student_not_approved",
} as const satisfies Record<ClaimError, string>;

/** Talabaning faol kuponlari (eskirganlari avval yopiladi). */
export const GET = route(async (request) => {
  const { user } = await requireApiStudent(request);
  return ok({ coupons: await activeCoupons(user.id) });
});

/**
 * Kupon olish (T5 "Chegirmani olish"): online, tranzaksiyada (`claimCoupon` — qoldiq, limit, ochiqlik). Shu chegirmada
 * faol kupon bo'lsa o'sha qaytadi (`existing: true`). Javobdagi `secret` bilan QR va 6 raqamli kod qurilmada
 * hisoblanadi (offline TOTP, `src/lib/totp.ts`); kupon 10 daqiqa amal qiladi.
 */
export const POST = route(async (request) => {
  const { user } = await requireApiStudent(request);
  await limit("claim", user.id);
  const { discountId } = await readJson(request, z.object({ discountId: z.string().regex(/^[a-z0-9_]{10,40}$/) }));
  const result = await claimCoupon(user.id, discountId);
  if (!result.ok) throw new ApiError(CLAIM_ERRORS[result.error]);
  const coupon = await studentCoupon(user.id, result.couponId);
  if (!coupon) throw new ApiError("deal_not_available");
  return ok({ coupon, existing: result.existing }, result.existing ? 200 : 201);
});
