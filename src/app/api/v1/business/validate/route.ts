import { z } from "zod";
import { validateBusiness, type BusinessField } from "@/lib/business";
import { ok, readJson, route } from "@/server/api/http";

const STEPS: Record<"info" | "details", readonly BusinessField[]> = {
  info: ["name", "kind", "address"],
  details: ["workingHours", "tin", "description", "contactName"],
};

/**
 * Ro'yxat qadamini serverda tekshirish (saqlamaydi): 1-qadam `info` (nom, tur, manzil), 2-qadam `details`
 * (ish vaqti, STIR, tavsif, mas'ul shaxs). Qoidalar forma va server uchun bitta (`src/lib/business.ts`).
 * STIR bandligi bu yerda tekshirilmaydi — ro'yxatda (`tin_taken`).
 */
export const POST = route(async (request) => {
  const body = await readJson(
    request,
    z.object({
      step: z.enum(["info", "details"]),
      name: z.string().max(200).default(""),
      kind: z.string().max(40).default(""),
      address: z.string().max(400).default(""),
      workingHours: z.string().max(200).default(""),
      description: z.string().max(400).default(""),
      tin: z.string().max(40).default(""),
      contactName: z.string().max(200).default(""),
    }),
  );
  return ok({ ok: true, fields: validateBusiness(body, STEPS[body.step]) });
});
