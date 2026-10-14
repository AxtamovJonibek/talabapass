import { NextResponse, type NextRequest } from "next/server";
import { businessDocFile, verificationFile } from "@/server/admin/review";
import { audit } from "@/server/audit";
import { getUnlockedAdmin } from "@/server/auth/session";
import { storage } from "@/server/storage";

/**
 * Private fayllarni ko'rish: faqat admin. Har bir ochilish (rasm ko'rsatilishi, "Kattalashtirish", "Ochish")
 * audit log'ga yoziladi: kim, qaysi fayl, qachon.
 *   /api/admin/fayl/guvohnoma/<verificationId>
 *   /api/admin/fayl/hujjat/<businessDocId>
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/admin/fayl/[kind]/[id]">) {
  // Admin parol bilan ochilgan bo'lishi shart. Kimligini oshkor qilmaslik uchun ruxsatsizga ham, yo'q faylga ham bir xil javob.
  const user = await getUnlockedAdmin();
  if (!user) return new NextResponse(null, { status: 404 });

  const { kind, id } = await params;
  const file = kind === "guvohnoma" ? await verificationFile(id) : kind === "hujjat" ? await businessDocFile(id) : null;
  if (!file) return new NextResponse(null, { status: 404 });

  const bytes = await storage().get(file.fileKey);
  if (!bytes) return new NextResponse(null, { status: 404 });

  await audit({
    actorId: user.id,
    action: "file.view",
    entity: kind === "guvohnoma" ? "Verification" : "BusinessDoc",
    entityId: id,
    meta: { purpose: request.nextUrl.searchParams.get("maqsad") ?? "view" },
  });

  const isPdf = file.mime === "application/pdf";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": file.mime,
      "content-length": String(bytes.byteLength),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      // Brauzer va proksilar saqlamasin: har ko'rish serverga keladi (va audit'ga tushadi).
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      // Rasm hech qanday skript ishga tushira olmaydigan muhitda ochiladi; PDF brauzerning o'z ko'ruvchisida.
      ...(isPdf ? {} : { "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
