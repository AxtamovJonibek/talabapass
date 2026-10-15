import { NextResponse } from "next/server";
import { dispatchDue } from "@/server/notifications/send";

/**
 * Muddati kelgan rejalashtirilgan bildirishnomalarni yuboradi. `Authorization: Bearer <CRON_SECRET>` bilan chaqiriladi:
 * asosiy — GitHub Actions (har 5 daqiqa, .github/workflows/cron.yml), zaxira — Vercel kunlik cron (Hobby'da kuniga 1 marta).
 * Idempotent: ikki chaqiruv bir vaqtda kelsa ham xabar bir marta yuboriladi (atom "claim").
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 404 });
  return NextResponse.json(await dispatchDue());
}
