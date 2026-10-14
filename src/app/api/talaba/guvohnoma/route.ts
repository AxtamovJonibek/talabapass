import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { MAX_UPLOAD_BYTES } from "@/server/storage/file-rules";
import { submitStudentCard, type SubmitProblem } from "@/server/student/verification";

const STATUS: Record<SubmitProblem, number> = {
  empty: 400,
  bad_type: 415,
  too_large: 413,
  not_allowed: 403,
  daily_limit: 429,
};

/**
 * Talaba guvohnomasini yuklash. Fayl so'rov tanasida xom holda keladi (multipart emas),
 * asl nomi `x-file-name` sarlavhasida (URL-kodlangan).
 * Ruxsat: faqat kirgan talaba, faqat o'zi uchun.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return NextResponse.json({ ok: false, problem: "not_allowed" }, { status: 401 });

  // Katta so'rovni o'qimasdan rad etish (sarlavha yolg'on bo'lsa — pastda haqiqiy hajm tekshiriladi).
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  let name = "";
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") ?? "");
  } catch {
    // noto'g'ri kodlangan nom — standart nom ishlatiladi
  }

  const result = await submitStudentCard(user.id, bytes, name);
  return NextResponse.json(result, { status: result.ok ? 201 : STATUS[result.problem] });
}
