import { ApiError, ok, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { requireApiStudent } from "@/server/api/session";
import { readUploadedFile, uploadError } from "@/server/api/upload";
import { removeStudentAvatar, setStudentAvatar } from "@/server/profile-image";

/** Profil rasmi (multipart `file`, ilova kesgan 512×512 kvadrat; server baribir qayta kodlaydi — EXIF/GPS qolmaydi). */
export const POST = route(async (request) => {
  const { user } = await requireApiStudent(request);
  await limit("upload", user.id);
  const file = await readUploadedFile(request);
  const result = await setStudentAvatar(user.id, file.bytes);
  if (!result.ok) throw uploadError(result.problem);
  return ok({ ok: true }, 201);
});

export const DELETE = route(async (request) => {
  const { user } = await requireApiStudent(request);
  if (!(await removeStudentAvatar(user.id))) throw new ApiError("not_found");
  return ok({ ok: true });
});
