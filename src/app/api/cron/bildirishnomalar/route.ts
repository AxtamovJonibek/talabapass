import { connection, NextResponse } from "next/server";
import { checkExpoReceipts } from "@/server/notifications/expo-push";
import { dispatchDue } from "@/server/notifications/send";

/**
 * Muddati kelgan rejalashtirilgan bildirishnomalarni yuboradi. `Authorization: Bearer <CRON_SECRET>` bilan chaqiriladi:
 * serverdagi crontab (docs/server.md), zaxira — admin bildirishnomalar sahifasi ochilganda.
 * Idempotent: ikki chaqiruv bir vaqtda kelsa ham xabar bir marta yuboriladi (atom "claim").
 * Shu yerda ilova push kvitansiyalari ham tekshiriladi: o'chirilgan ilovalar tokeni bazadan olinadi.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  // Har chaqiruvda bajarilsin: aks holda build paytida (sirsiz) 404 javobi statik qotib qoladi va cron hech narsa qilmaydi
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 404 });
  const result = await dispatchDue();
  const removedDevices = await checkExpoReceipts().catch((error: unknown) => {
    console.error("[cron] push kvitansiyalari:", error);
    return 0;
  });
  return NextResponse.json({ ...result, removedDevices });
}
