import { connection, NextResponse } from "next/server";
import { runOrderAutomation } from "@/server/preorder/orders";

/**
 * Buyurtmalar avtomatikasi: to'lanmagan va javobsiz qolganlarni bekor qilish (pul qaytadi), slot tugab kelmaganlar —
 * "Kelmadi". Serverdagi crontab har 5 daqiqada chaqiradi; biznes va talaba sahifalarida
 * lazy ham ishlaydi. Idempotent.
 */
export async function GET(request: Request) {
  // Har chaqiruvda bajarilsin: aks holda build paytida (sirsiz) 404 javobi statik qotib qoladi va cron hech narsa qilmaydi
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 404 });
  return NextResponse.json(await runOrderAutomation());
}
