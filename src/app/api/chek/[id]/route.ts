import { NextResponse } from "next/server";
import { getCurrentUser, getUnlockedAdmin } from "@/server/auth/session";
import { canViewReceipt, receipt, receiptPdfUz } from "@/server/coupons/receipts";

/** Chek PDF'i (WT4 "PDF yuklab olish"). Talaba, biznes egasi/kassiri, admin; boshqalarga 404. */
export async function GET(_request: Request, { params }: RouteContext<"/api/chek/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !/^[a-z0-9_]{10,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  const found = await receipt(id);
  const admin = user.role === "ADMIN" && (await getUnlockedAdmin()) !== null;
  if (!found || !(await canViewReceipt(user, found, admin))) return new NextResponse(null, { status: 404 });
  const pdf = await receiptPdfUz(found.data);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="chek-${found.data.no}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
