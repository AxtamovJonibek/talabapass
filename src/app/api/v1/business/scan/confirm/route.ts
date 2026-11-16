import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { requireApiScanner, scanError } from "@/server/api/business";
import { signedFileUrl } from "@/server/api/files";
import { limit } from "@/server/api/rate-limit";
import { AMOUNT_MAX, confirmRedemption } from "@/server/coupons/scan";
import { receipt } from "@/server/coupons/receipts";

const input = z.object({
  couponId: z.string().regex(/^[a-z0-9_]{10,40}$/),
  ticket: z.string().max(200),
  paymentType: z.enum(["CASH", "CARD", "QR"]),
  amount: z.number().int().min(1).max(AMOUNT_MAX).nullable().optional(),
});

/**
 * B4 "Sotuvni tasdiqlash" → chek. Atom: ikki kassir bir vaqtda bossa faqat bittasi o'tadi (ikkinchisi `scan_replayed`).
 * Narxsiz chegirmada `amount` — chek summasi (foizli) yoki bitta mahsulot narxi (1+1). `ticket` 5 daqiqa amal qiladi.
 */
export const POST = route(async (request) => {
  const { user, scanner } = await requireApiScanner(request);
  await limit("scan", user.id);
  const body = await readJson(request, input);
  const result = await confirmRedemption(scanner, body);
  if (!result.ok) {
    if (result.error === "ticket") throw new ApiError("scan_ticket");
    if (result.error === "amount") throw new ApiError("invalid_request", { fields: ["amount"] });
    throw scanError(result.error);
  }
  const found = await receipt(result.redemptionId);
  if (!found) throw new ApiError("not_found");
  return ok({ receipt: found.data, pdfUrl: signedFileUrl("receipt", found.data.id) }, 201);
});
