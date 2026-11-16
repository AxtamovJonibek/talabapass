import { ApiError, idParam, ok, route } from "@/server/api/http";
import { signedFileUrl } from "@/server/api/files";
import { requireApiRole } from "@/server/api/session";
import { canViewReceipt, receipt } from "@/server/coupons/receipts";

/**
 * Chek (B4, T7): talabaning o'zi, biznes egasi va kassir — faqat **o'zi tasdiqlagan** sotuv. Boshqalarga 404.
 * `pdfUrl` — imzoli havola (1–2 soat), brauzerda ochiladi.
 */
export const GET = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiRole(request, "STUDENT", "BUSINESS_OWNER", "CASHIER");
  const found = await receipt(await idParam(ctx));
  if (!found || !(await canViewReceipt(user, found, false)) || (user.role === "CASHIER" && found.cashierId !== user.id)) throw new ApiError("not_found");
  return ok({ receipt: found.data, pdfUrl: signedFileUrl("receipt", found.data.id) });
});
