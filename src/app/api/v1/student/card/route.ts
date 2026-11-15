import { ok, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { requireApiStudent } from "@/server/api/session";
import { readUploadedFile, uploadError } from "@/server/api/upload";
import { submitStudentCard } from "@/server/student/verification";

/**
 * Talaba guvohnomasi: `multipart/form-data`, maydon `file` (JPG/PNG/HEIC/PDF, 10 MB gacha). Saytdagi kabi tozalanadi
 * (EXIF/GPS yo'q), private omborga yoziladi, holat PENDING. Tasdiqlangan talaba qayta yuklamaydi.
 */
export const POST = route(async (request) => {
  const { user } = await requireApiStudent(request, { approved: false });
  await limit("upload", user.id);
  const file = await readUploadedFile(request);
  const result = await submitStudentCard(user.id, file.bytes, file.name);
  if (!result.ok) throw uploadError(result.problem);
  return ok({ verificationId: result.verificationId, status: "PENDING" }, 201);
});
