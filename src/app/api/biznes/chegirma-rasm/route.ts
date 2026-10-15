import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { removeDiscountImage, uploadDiscountImage, type ImageProblem } from "@/server/business/discount-images";
import { readLimited } from "@/server/http/read-limited";
import { MAX_UPLOAD_BYTES } from "@/server/storage/file-rules";

const STATUS: Record<ImageProblem, number> = { empty: 400, bad_type: 415, too_large: 413, not_allowed: 403, too_many: 409, daily_limit: 429 };
const ID = /^[a-z0-9]{10,40}$/;

/** B2 / WB2 chegirma rasmi: `POST ?chegirma=<id>` (xom tana), `DELETE ?rasm=<id>`. Faqat o'z biznesining egasi. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "BUSINESS_OWNER") return NextResponse.json({ ok: false, problem: "not_allowed" }, { status: 401 });
  const discountId = request.nextUrl.searchParams.get("chegirma") ?? "";
  if (!ID.test(discountId)) return NextResponse.json({ ok: false, problem: "not_allowed" }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });
  const bytes = await readLimited(request, MAX_UPLOAD_BYTES);
  if (!bytes) return NextResponse.json({ ok: false, problem: "too_large" }, { status: 413 });
  const result = await uploadDiscountImage(user.id, discountId, bytes);
  return NextResponse.json(result, { status: result.ok ? 201 : STATUS[result.problem] });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "BUSINESS_OWNER") return NextResponse.json({ ok: false }, { status: 401 });
  const imageId = request.nextUrl.searchParams.get("rasm") ?? "";
  const ok = ID.test(imageId) && (await removeDiscountImage(user.id, imageId));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
