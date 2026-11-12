import { NextResponse } from "next/server";
import { ORDER_FILTERS, type OrderFilter } from "@/lib/preorder";
import { getCurrentUser } from "@/server/auth/session";
import { businessOrders, ownerOrdersBusiness } from "@/server/preorder/views";

/**
 * "Buyurtmalar" jonli ro'yxati (5 soniyada so'raladi): `GET ?holat=new|preparing|ready|done`. Server action emas —
 * action'lar navbat bilan bajariladi va so'rovlar "Qabul qilish" kabi bosishlarni kutib qoldirardi.
 * Faqat biznes egasi o'z biznesi uchun (biznes sessiyadan); boshqalarga 404.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "BUSINESS_OWNER") return new NextResponse(null, { status: 404 });
  const business = await ownerOrdersBusiness(user.id);
  if (!business) return new NextResponse(null, { status: 404 });
  const filter = new URL(request.url).searchParams.get("holat") ?? "new";
  if (!(filter in ORDER_FILTERS)) return new NextResponse(null, { status: 400 });
  return NextResponse.json(await businessOrders(business.id, filter as OrderFilter), { headers: { "Cache-Control": "no-store" } });
}
