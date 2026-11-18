import { z } from "zod";
import { signedFileUrl } from "@/server/api/files";
import { ok, readQuery, route } from "@/server/api/http";
import { requireApiStudent } from "@/server/api/session";
import { studentHistory } from "@/server/coupons/receipts";

/**
 * T7 — xaridlar tarixi (saytdagi `/tarix` bilan bir xil ma'lumot): `?oy=YYYY-MM` (bo'lmasa joriy oy) → oy, oylar ro'yxati,
 * tejalgan summa, xaridlar soni, cheklar (har biriga imzoli PDF havolasi) va butun davr jami.
 */
export const GET = route(async (request) => {
  const { user } = await requireApiStudent(request);
  const q = readQuery(request, z.object({ oy: z.string().regex(/^\d{4}-\d{2}$/).optional() }));
  const history = await studentHistory(user.id, q.oy ?? null);
  return ok({ ...history, receipts: history.receipts.map((r) => ({ ...r, pdfUrl: signedFileUrl("receipt", r.id) })) });
});
