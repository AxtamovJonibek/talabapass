import { NextResponse } from "next/server";
import { parsePeriod } from "@/lib/stats";
import { getCurrentUser } from "@/server/auth/session";
import { REPORT_MIME, statsReport } from "@/server/business/report";
import { ownerStatsBusiness } from "@/server/business/stats";

/**
 * B6 "Excel hisobot" (`statsReport`). Faqat biznes egasi o'z biznesi uchun (biznes faqat sessiyadan); boshqalarga 404.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "BUSINESS_OWNER") return new NextResponse(null, { status: 404 });
  const business = await ownerStatsBusiness(user.id);
  if (!business) return new NextResponse(null, { status: 404 });

  const period = parsePeriod(new URL(request.url).searchParams.get("davr") ?? undefined);
  const report = await statsReport(business, period);
  return new NextResponse(Buffer.from(report.bytes), {
    headers: {
      "content-type": REPORT_MIME,
      "content-disposition": `attachment; filename="${report.name}"`,
      "cache-control": "no-store",
    },
  });
}
