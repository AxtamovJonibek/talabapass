import { z } from "zod";
import { ok, readJson, route } from "@/server/api/http";
import { scanError, requireApiScanner } from "@/server/api/business";
import { limit } from "@/server/api/rate-limit";
import { scanCoupon, scannerSummary, shortName } from "@/server/coupons/scan";
import { orderCodeOf, scanOrder } from "@/server/preorder/scan";

const input = z.union([z.object({ qr: z.string().min(1).max(200) }), z.object({ code: z.string().min(1).max(40), totp: z.string().max(20) })]);

/**
 * B3 skan: QR matni yoki kupon kodi + 6 raqamli kod (faqat kod hech qachon yetmaydi). Biznes — sessiyadan (kassir —
 * faol a'zoligi, egasi — tasdiqlangan biznesi). Har urinish `ScanAttempt` ga. Sotuv hali yozilmaydi: kupon —
 * `{ kind: "coupon", preview }` → `POST /business/scan/confirm`; `TB-` buyurtma — `{ kind: "order", order }` →
 * `POST /business/orders/<id>` (`complete`). Xato — `scan_*` / `order_*` kodi va `result` (+ `attemptsLeft`).
 */
export const POST = route(async (request) => {
  const { user, scanner } = await requireApiScanner(request);
  await limit("scan", user.id);
  const body = await readJson(request, input);
  if (orderCodeOf(body)) {
    const outcome = await scanOrder(scanner, body);
    if (!outcome.ok) throw scanError(outcome.result);
    return ok({ kind: "order", order: outcome.order });
  }
  const outcome = await scanCoupon(scanner, body);
  if (!outcome.ok) throw scanError(outcome.result, outcome.attemptsLeft);
  return ok({ kind: "coupon", preview: outcome.preview });
});

/** B3 sarlavhasi: biznes nomi, kassir (qisqa ism), bugungi sotuvlar soni va oxirgi sotuv (`at` — ISO). */
export const GET = route(async (request) => {
  const { user, scanner } = await requireApiScanner(request);
  const { todaySales, lastSale } = await scannerSummary(scanner);
  return ok({
    business: { name: scanner.businessName },
    cashierName: shortName(user.firstName, user.lastName),
    todaySales,
    lastSale: lastSale ? { ...lastSale, at: lastSale.at.toISOString() } : null,
  });
});
