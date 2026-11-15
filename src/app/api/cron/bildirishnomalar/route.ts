import { NextResponse } from "next/server";
import { dispatchDue } from "@/server/notifications/send";

/**
 * Muddati kelgan rejalashtirilgan bildirishnomalarni yuboradi. `Authorization: Bearer <CRON_SECRET>` bilan chaqiriladi:
 * serverdagi crontab (docs/server.md), zaxira — admin bildirishnomalar sahifasi ochilganda.
 * Idempotent: ikki chaqiruv bir vaqtda kelsa ham xabar bir marta yuboriladi (atom "claim").
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 404 });
  return NextResponse.json(await dispatchDue());
}
