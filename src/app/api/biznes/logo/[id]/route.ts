import { NextResponse } from "next/server";
import { getCurrentUser, getUnlockedAdmin } from "@/server/auth/session";
import { readBusinessLogo } from "@/server/profile-image";

/** Biznes logotipi: tasdiqlangan biznesniki hammaga (kesh bilan), aks holda faqat egasi va admin. */
export async function GET(_request: Request, { params }: RouteContext<"/api/biznes/logo/[id]">) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  const viewer = user?.role === "ADMIN" ? await getUnlockedAdmin() : user;
  const file = await readBusinessLogo(id, viewer ? { id: viewer.id, role: viewer.role } : null);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.bytes.byteLength),
      "cache-control": file.public ? "public, max-age=3600" : "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
