import { NextResponse } from "next/server";
import { handlePaymentCallback } from "@/server/preorder/orders";

/**
 * To'lov provayderi callback'i: `POST /api/tolov/<provayder>`. Imzo provayderning `verifyCallback` ida; xom tana
 * `PaymentLog` ga yoziladi. Takroriy callback xavfsiz (to'lov holati shartli o'zgaradi).
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const body = await request.text();
  if (body.length > 20_000) return new NextResponse(null, { status: 413 });
  const result = await handlePaymentCallback(provider, body, request.headers);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false }, { status: 400 });
}
