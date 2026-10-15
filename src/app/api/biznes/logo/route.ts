import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { readLimited } from "@/server/http/read-limited";
import { removeBusinessLogo, setBusinessLogo, type ImageProblem } from "@/server/profile-image";
import { MAX_UPLOAD_BYTES } from "@/server/storage/file-rules";

const STATUS: Record<ImageProblem, number> = { empty: 400, bad_type: 415, too_large: 413, not_allowed: 403, daily_limit: 429 };

/** Biznes logotipi: `POST` (xom rasm tanasi, mijoz kesgan kvadrat) va `DELETE`. Faqat o'z biznesining egasi. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "BUSINESS_OWNER") return NextResponse.json({ ok: false, problem: "not_allowed" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });
  const bytes = await readLimited(request, MAX_UPLOAD_BYTES);
  if (!bytes) return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });
  const result = await setBusinessLogo(user.id, bytes);
  return NextResponse.json(result.ok ? { ok: true } : result, { status: result.ok ? 201 : STATUS[result.problem] });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (user?.role !== "BUSINESS_OWNER") return NextResponse.json({ ok: false }, { status: 401 });
  const ok = await removeBusinessLogo(user.id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
