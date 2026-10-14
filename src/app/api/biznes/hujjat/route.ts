import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { uploadBusinessDoc, type DocProblem, type DocUploadKind } from "@/server/business/registration";
import { readLimited, uploadedFileName } from "@/server/http/read-limited";
import { MAX_UPLOAD_BYTES } from "@/server/storage/file-rules";

const STATUS: Record<DocProblem, number> = {
  empty: 400,
  bad_type: 415,
  too_large: 413,
  not_allowed: 403,
  daily_limit: 429,
  too_many: 409,
};
const KINDS: readonly DocUploadKind[] = ["registration", "photo", "logo"];

/**
 * Biznes arizasi fayli (WB1 / B1): `?tur=registration|photo|logo`. Faqat kirgan biznes egasi, faqat o'z arizasiga.
 * Fayl so'rov tanasida xom holda keladi, asl nomi `x-file-name` sarlavhasida.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "BUSINESS_OWNER") return NextResponse.json({ ok: false, problem: "not_allowed" }, { status: 401 });

  const kind = request.nextUrl.searchParams.get("tur") as DocUploadKind;
  if (!KINDS.includes(kind)) return NextResponse.json({ ok: false, problem: "bad_type" }, { status: 400 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });
  }
  const bytes = await readLimited(request, MAX_UPLOAD_BYTES);
  if (!bytes) return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });

  const result = await uploadBusinessDoc(user.id, kind, bytes, uploadedFileName(request));
  return NextResponse.json(result, { status: result.ok ? 201 : STATUS[result.problem] });
}
