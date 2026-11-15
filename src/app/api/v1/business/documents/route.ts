import { z } from "zod";
import { ok, readQuery, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { requireApiRole } from "@/server/api/session";
import { readUploadedFile, uploadError } from "@/server/api/upload";
import { uploadBusinessDoc } from "@/server/business/registration";

/**
 * Ariza fayli: `?kind=registration|photo|logo`, `multipart/form-data` maydon `file`. Guvohnoma bitta (yangisi
 * almashtiradi, PDF ham bo'ladi), joy fotolari 3 tagacha, logotip va foto — faqat rasm. Saytdagi kabi tozalanadi.
 */
export const POST = route(async (request) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  const { kind } = readQuery(request, z.object({ kind: z.enum(["registration", "photo", "logo"]) }));
  await limit("upload", user.id);
  const file = await readUploadedFile(request);
  const result = await uploadBusinessDoc(user.id, kind, file.bytes, file.name);
  if (!result.ok) throw uploadError(result.problem);
  return ok({ id: result.id, kind }, 201);
});
