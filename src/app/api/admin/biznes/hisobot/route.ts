import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { parsePeriod } from "@/lib/stats";
import { audit } from "@/server/audit";
import { getUnlockedAdmin } from "@/server/auth/session";
import { REPORT_MIME, statsReport } from "@/server/business/report";
import { db } from "@/server/db";

/** Admin: istalgan biznesning Excel hisoboti (`?id=&davr=1|7|30`, egasiniki bilan bir xil). Audit `business.export`. */
export async function GET(request: NextRequest) {
  await connection();
  const admin = await getUnlockedAdmin();
  if (!admin) return new NextResponse(null, { status: 404 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const business = /^[a-z0-9]{10,40}$/.test(id) ? await db.business.findUnique({ where: { id }, select: { id: true, name: true } }) : null;
  if (!business) return new NextResponse(null, { status: 404 });
  const period = parsePeriod(request.nextUrl.searchParams.get("davr") ?? undefined);
  const report = await statsReport(business, period);
  await audit({ actorId: admin.id, action: "business.export", entity: "Business", entityId: business.id, meta: { period } });
  return new NextResponse(Buffer.from(report.bytes), {
    headers: { "content-type": REPORT_MIME, "content-disposition": `attachment; filename="${report.name}"`, "cache-control": "no-store" },
  });
}
