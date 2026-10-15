import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";

/**
 * Web Push obunasi: brauzer bergan endpoint va kalitlar joriy foydalanuvchiga bog'lanadi (sessiyadan — tanadagi
 * foydalanuvchiga ishonilmaydi). Bitta endpoint — bitta foydalanuvchi: qurilmada boshqa hisob kirsa, obuna unga o'tadi.
 */
const subscription = z.object({
  endpoint: z.url().max(1000).refine((value) => value.startsWith("https://"), "https"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const parsed = subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await db.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
