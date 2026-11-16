import { z } from "zod";
import { ApiError, idParam, ok, readJson, route } from "@/server/api/http";
import { requireApiOwner, requireApiScanner } from "@/server/api/business";
import { limit } from "@/server/api/rate-limit";
import { completeOrderScan } from "@/server/preorder/scan";
import { decideOrder } from "@/server/preorder/views";

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("ready") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(150) }),
  z.object({ action: z.literal("complete"), ticket: z.string().max(200) }),
]);

const ERRORS = { notFound: "not_found", forbidden: "forbidden", conflict: "order_conflict" } as const;

/**
 * Buyurtma holati — faqat `transitionOrder` orqali (holat mashinasi, sig'im, pul, xabarnoma). `accept` | `reject`
 * (sabab majburiy, talabaga ko'rinadi) | `ready` — egasi; `complete` ("Berildi") — skanerdan keyin, egasi yoki kassir,
 * `ticket` skan javobidan.
 */
export const POST = route<{ id: string }>(async (request, ctx) => {
  const id = await idParam(ctx);
  const body = await readJson(request, input);
  if (body.action === "complete") {
    const { user, scanner } = await requireApiScanner(request);
    await limit("scan", user.id);
    const result = await completeOrderScan(scanner, id, body.ticket);
    if (!result.ok) throw result.error === "ticket" ? new ApiError("scan_ticket") : new ApiError(ERRORS[result.error]);
    return ok({ ok: true });
  }
  const { user } = await requireApiOwner(request);
  await limit("write", user.id);
  if (body.action === "reject" && !body.reason.trim()) throw new ApiError("invalid_request", { fields: ["reason"] });
  const result = await decideOrder(user.id, id, body.action, body.action === "reject" ? body.reason : undefined);
  if (!result.ok) throw new ApiError(ERRORS[result.error]);
  return ok({ ok: true });
});
