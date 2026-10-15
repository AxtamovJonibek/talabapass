import { NextResponse } from "next/server";
import { getCurrentUser, getUnlockedAdmin } from "@/server/auth/session";
import { readDiscountImage } from "@/server/business/discount-images";

/**
 * Chegirma rasmi. Talabaga ko'rinadigan chegirmaniki — hammaga (kesh bilan); boshqasi — faqat egasi va admin.
 * Ruxsat yo'q yoki fayl yo'q — bir xil 404.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/chegirma/rasm/[id]">) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  const viewer = user?.role === "ADMIN" ? await getUnlockedAdmin() : user;
  const file = await readDiscountImage(id, viewer ? { id: viewer.id, role: viewer.role } : null);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.bytes.byteLength),
      // Rasm id'si o'zgarmas (yangi rasm — yangi id); tekshiruvdagisi faqat shaxsiy keshda
      "cache-control": file.public ? "public, max-age=3600" : "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
