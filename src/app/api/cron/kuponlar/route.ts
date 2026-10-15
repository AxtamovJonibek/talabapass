import { NextResponse } from "next/server";
import { expireDueCoupons } from "@/server/coupons/coupons";

/**
 * Eskirgan kuponlarni yopish (qoldiq qaytadi). Vercel Cron `Authorization: Bearer <CRON_SECRET>` bilan chaqiradi.
 * Asosiy yo'l baribir lazy: har "olish", skan va kuponlar ro'yxati oldidan — cron faqat zaxira.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 404 });
  return NextResponse.json({ closed: await expireDueCoupons({}, 5000) });
}
