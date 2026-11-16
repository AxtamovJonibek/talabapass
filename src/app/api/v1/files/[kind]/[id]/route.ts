import { NextResponse, type NextRequest } from "next/server";
import { ApiError, route } from "@/server/api/http";
import { fileSignatureOk, isFileKind, readSignedFile } from "@/server/api/files";

/**
 * Imzoli fayl havolasi (rasm yoki chek PDF'i): `?exp=&sig=` API javobida beriladi (`signUrls`), sarlavhasiz ochiladi.
 * Imzo buzilgan, muddati o'tgan yoki fayl yo'q — bir xil 404.
 */
export const GET = route<{ kind: string; id: string }>(async (request: NextRequest, ctx) => {
  const { kind, id } = await ctx.params;
  const exp = Number(request.nextUrl.searchParams.get("exp"));
  const sig = request.nextUrl.searchParams.get("sig") ?? "";
  if (!isFileKind(kind) || !/^[a-z0-9_]{10,40}$/.test(id) || !fileSignatureOk(kind, id, exp, sig)) throw new ApiError("not_found");
  const file = await readSignedFile(kind, id);
  if (!file) throw new ApiError("not_found");
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.bytes.byteLength),
      // Havola o'zi muddatli; qurilma keshida saqlansa bo'ladi, umumiy keshda emas
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      ...(file.name ? { "content-disposition": `inline; filename="${file.name}"` } : {}),
    },
  });
});
