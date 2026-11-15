import "server-only";
import type { UploadProblem } from "../storage/file-rules";
import { MAX_UPLOAD_BYTES } from "../storage/file-rules";
import { readLimited } from "../http/read-limited";
import { ApiError, type ApiErrorCode } from "./http";

/** multipart sarlavhalari va chegaralari uchun fayl hajmidan ortiq joy */
const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * `multipart/form-data` dagi bitta fayl (`file` maydoni). Tana o'qilayotganda hajm chegarasi tekshiriladi
 * (`request.formData()` butun tanani cheklovsiz o'qiydi) — keyin xotiradagi nusxadan ajratiladi.
 */
export async function readUploadedFile(request: Request, field = "file"): Promise<{ bytes: Uint8Array; name: string }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) throw new ApiError("invalid_request", { fields: [field] });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD) throw new ApiError("file_too_large");

  const body = await readLimited(request, MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD);
  if (!body) throw new ApiError("file_too_large");
  let form: FormData;
  try {
    form = await new Response(body as BodyInit, { headers: { "content-type": type } }).formData();
  } catch {
    throw new ApiError("invalid_request", { fields: [field] });
  }
  const file = form.get(field);
  if (!(file instanceof Blob)) throw new ApiError("invalid_request", { fields: [field] });
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError("file_too_large");
  return { bytes: new Uint8Array(await file.arrayBuffer()), name: file instanceof File ? file.name : "" };
}

const UPLOAD_ERRORS: Record<UploadProblem | "not_allowed" | "daily_limit" | "too_many", ApiErrorCode> = {
  empty: "file_empty",
  bad_type: "file_bad_type",
  too_large: "file_too_large",
  not_allowed: "upload_not_allowed",
  daily_limit: "upload_daily_limit",
  too_many: "too_many_files",
};

export const uploadError = (problem: keyof typeof UPLOAD_ERRORS) => new ApiError(UPLOAD_ERRORS[problem]);
