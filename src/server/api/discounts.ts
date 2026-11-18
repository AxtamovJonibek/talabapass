import "server-only";
import { z } from "zod";
import { discountDraftSchema, type SaveDiscountResult } from "../business/discounts";
import { ApiError } from "./http";

/** `POST /business/discounts` va `PATCH /business/discounts/<id>` tanasi: forma va "Qoralama" | "E'lon qilish". */
export const saveDiscountInput = z.object({ draft: discountDraftSchema, intent: z.enum(["draft", "publish"]) });

/** Saqlash natijasi → javob yoki xato. Tekshiruv xatolari: `invalid_request` + `fields` + `problems` ({ maydon: sabab }). */
export function savedOrThrow(result: SaveDiscountResult): { id: string; status: string } {
  if (result.ok) return { id: result.id, status: result.status };
  if ("errors" in result) throw new ApiError("invalid_request", { fields: Object.keys(result.errors), problems: result.errors });
  throw new ApiError(
    result.error === "notFound"
      ? "not_found"
      : result.error === "noBusiness"
        ? "business_not_ready"
        : result.error === "noPermission"
          ? "permission_denied"
          : result.error === "activeLimit"
            ? "active_limit"
            : "not_editable",
  );
}

