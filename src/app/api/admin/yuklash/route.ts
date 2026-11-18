import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { setPartnerLogo } from "@/server/admin/landing-admin";
import { addPhotoByAdmin, setLogoByAdmin } from "@/server/admin/super";
import { getUnlockedAdmin } from "@/server/auth/session";
import { readLimited } from "@/server/http/read-limited";
import { MAX_UPLOAD_BYTES } from "@/server/storage/file-rules";

const ID = /^[a-z0-9]{10,40}$/;

/**
 * Admin fayl yuklashi (xom rasm tanasi): `?tur=logo&biznes=<id>` — biznes logotipi, `?tur=foto&biznes=<id>&nom=` — joy
 * fotosi, `?tur=hamkor&biznes=<id>` yoki `&hamkor=<id>` — landing hamkor logotipi. Faqat paroli kiritilgan admin (boshqalarga 404).
 * Fayl tozalanadi (`sanitizeDocument`), audit — server funksiyalarida.
 */
export async function POST(request: NextRequest) {
  await connection();
  const admin = await getUnlockedAdmin();
  if (!admin) return new NextResponse(null, { status: 404 });
  const q = request.nextUrl.searchParams;
  const kind = q.get("tur");
  const businessId = q.get("biznes") ?? "";
  const partnerId = q.get("hamkor") ?? "";
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, error: "badFile" }, { status: 413 });
  const bytes = await readLimited(request, MAX_UPLOAD_BYTES);
  if (!bytes) return NextResponse.json({ ok: false, error: "badFile" }, { status: 413 });

  const result =
    kind === "logo" && ID.test(businessId)
      ? await setLogoByAdmin(admin.id, businessId, bytes)
      : kind === "foto" && ID.test(businessId)
        ? await addPhotoByAdmin(admin.id, businessId, bytes, (q.get("nom") ?? "").slice(0, 120))
        : kind === "hamkor" && (ID.test(businessId) || ID.test(partnerId))
          ? await setPartnerLogo(admin.id, ID.test(businessId) ? { businessId } : { partnerId }, bytes)
          : { ok: false as const, error: "invalid" as const };
  return NextResponse.json(result, { status: result.ok ? 201 : result.error === "notFound" ? 404 : 400 });
}
