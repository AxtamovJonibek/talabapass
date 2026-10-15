import { NextResponse } from "next/server";
import { getCurrentUser, getUnlockedAdmin } from "@/server/auth/session";
import { readStudentAvatar } from "@/server/profile-image";

/** Talaba avatari — faqat o'zi va admin. Ruxsat yo'q yoki rasm yo'q — bir xil 404. */
export async function GET(_request: Request, { params }: RouteContext<"/api/avatar/[id]">) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  const viewer = user?.role === "ADMIN" ? await getUnlockedAdmin() : user;
  const file = await readStudentAvatar(id, viewer ? { id: viewer.id, role: viewer.role } : null);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.bytes.byteLength),
      // Manzilda versiya bor (?v=): yangi rasm — yangi manzil
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
