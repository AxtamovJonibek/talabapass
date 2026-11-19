import { z } from "zod";
import { ok, readQuery, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { requireApiRole } from "@/server/api/session";
import { readUploadedFile, uploadError } from "@/server/api/upload";
import { uploadBusinessDoc } from "@/server/business/registration";

/** Ariza rasmi: `?kind=logo`, `multipart/form-data` maydon `file`, faqat rasm (yangisi eskisini almashtiradi). Saytdagi kabi tozalanadi. */
export const POST = route(async (request) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  const { kind } = readQuery(request, z.object({ kind: z.literal("logo") }));
  await limit("upload", user.id);
  const file = await readUploadedFile(request);
  const result = await uploadBusinessDoc(user.id, kind, file.bytes, file.name);
  if (!result.ok) throw uploadError(result.problem);
  return ok({ id: result.id, kind }, 201);
});
