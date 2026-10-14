import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { authSecret } from "@/server/env";
import { readLimited, uploadedFileName } from "@/server/http/read-limited";
import { MAX_UPLOAD_BYTES } from "@/server/storage/file-rules";
import { readUploadToken } from "@/server/student/upload-token";
import { submitStudentCard, type SubmitProblem } from "@/server/student/verification";

const STATUS: Record<SubmitProblem, number> = {
  empty: 400,
  bad_type: 415,
  too_large: 413,
  not_allowed: 403,
  daily_limit: 429,
};

/**
 * Kim nomidan yuklanmoqda: kirgan talaba (sessiya) yoki kompyuterdagi sahifa bergan qisqa muddatli token
 * (`x-upload-token` — telefon bilan rasmga olish). Boshqa hech kim.
 */
async function uploaderId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get("x-upload-token");
  if (token) return readUploadToken(token, authSecret());
  const user = await getCurrentUser();
  return user?.role === "STUDENT" ? user.id : null;
}

/**
 * Talaba guvohnomasini yuklash. Fayl so'rov tanasida xom holda keladi (multipart emas),
 * asl nomi `x-file-name` sarlavhasida (URL-kodlangan).
 */
export async function POST(request: NextRequest) {
  const userId = await uploaderId(request);
  if (!userId) return NextResponse.json({ ok: false, problem: "not_allowed" }, { status: 401 });

  // Katta so'rovni o'qimasdan rad etish (sarlavha yolg'on bo'lsa — pastda haqiqiy hajm tekshiriladi).
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });
  }

  const bytes = await readLimited(request, MAX_UPLOAD_BYTES);
  if (!bytes) return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });
  const result = await submitStudentCard(userId, bytes, uploadedFileName(request));
  return NextResponse.json(result, { status: result.ok ? 201 : STATUS[result.problem] });
}
