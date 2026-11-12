import { NextResponse } from "next/server";
import { runOrderAutomation } from "@/server/preorder/orders";

/**
 * Buyurtmalar avtomatikasi: to'lanmagan va javobsiz qolganlarni bekor qilish (pul qaytadi), slot tugab kelmaganlar —
 * "Kelmadi". GitHub Actions har 5 daqiqada chaqiradi (`.github/workflows/cron.yml`); biznes va talaba sahifalarida
 * lazy ham ishlaydi. Idempotent.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 404 });
  return NextResponse.json(await runOrderAutomation());
}
