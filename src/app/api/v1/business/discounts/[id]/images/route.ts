import { idParam, ok, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { signedFileUrl } from "@/server/api/files";
import { limit } from "@/server/api/rate-limit";
import { readUploadedFile, uploadError } from "@/server/api/upload";
import { uploadDiscountImage } from "@/server/business/discount-images";

/**
 * Chegirma rasmi (multipart `file`): 4 tagacha, faqat rasm, saytdagi kabi tozalanadi (EXIF/GPS yo'q). Tasdiqlangan
 * chegirmada rasm qo'shilsa — qayta `PENDING_REVIEW`. → 201 `{ id, url }` (url imzoli).
 */
export const POST = route<{ id: string }>(async (request, ctx) => {
  const { user } = await requireApiOwner(request);
  const id = await idParam(ctx);
  await limit("upload", user.id);
  const file = await readUploadedFile(request);
  const result = await uploadDiscountImage(user.id, id, file.bytes);
  if (!result.ok) throw uploadError(result.problem);
  return ok({ id: result.id, url: signedFileUrl("discount-image", result.id) }, 201);
});
