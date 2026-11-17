import { connection, NextResponse } from "next/server";
import { expireDueCoupons } from "@/server/coupons/coupons";

/**
 * Eskirgan kuponlarni yopish (qoldiq qaytadi). Serverdagi crontab `Authorization: Bearer <CRON_SECRET>` bilan chaqiradi.
 * Asosiy yo'l baribir lazy: har "olish", skan va kuponlar ro'yxati oldidan — cron faqat zaxira.
 */
export async function GET(request: Request) {
  // Har chaqiruvda bajarilsin: aks holda build paytida (sirsiz) 404 javobi statik qotib qoladi va cron hech narsa qilmaydi
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 404 });
  return NextResponse.json({ closed: await expireDueCoupons({}, 5000) });
}
