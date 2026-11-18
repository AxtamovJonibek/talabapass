import { NextResponse } from "next/server";
import { connection } from "next/server";
import { readPartnerLogo } from "@/server/admin/landing-admin";

/** Landing "Hamkorlarimiz" logotipi (admin yuklagan): yashirilmagan qatorniki hammaga, kesh bilan; boshqasi — 404. */
export async function GET(_request: Request, { params }: RouteContext<"/api/landing/hamkor/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  const file = await readPartnerLogo(id);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.bytes.byteLength),
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
