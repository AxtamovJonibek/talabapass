import { ApiError, ok, route } from "@/server/api/http";
import { requireApiOwner } from "@/server/api/business";
import { limit } from "@/server/api/rate-limit";
import { readUploadedFile, uploadError } from "@/server/api/upload";
import { removeBusinessLogo, setBusinessLogo } from "@/server/profile-image";

/** Logotip (multipart `file`, kvadrat rasm; server baribir tozalaydi va 512×512 ga keltiradi). */
export const POST = route(async (request) => {
  const { user } = await requireApiOwner(request);
  await limit("upload", user.id);
  const file = await readUploadedFile(request);
  const result = await setBusinessLogo(user.id, file.bytes);
  if (!result.ok) throw uploadError(result.problem);
  return ok({ ok: true }, 201);
});

export const DELETE = route(async (request) => {
  const { user } = await requireApiOwner(request);
  if (!(await removeBusinessLogo(user.id))) throw new ApiError("not_found");
  return ok({ ok: true });
});
