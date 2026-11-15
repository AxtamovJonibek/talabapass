import { z } from "zod";
import { ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { authenticate } from "@/server/api/session";
import { db } from "@/server/db";

const device = z.object({ token: z.string().min(10).max(500), platform: z.enum(["IOS", "ANDROID"]) });

/**
 * Push tokenini ro'yxatga olish (Expo/FCM/APNs). Joriy sessiyaga bog'lanadi: chiqish/bloklashda o'zi o'chadi.
 * Bitta token — bitta foydalanuvchi: qurilmada boshqa hisob kirsa, token unga o'tadi.
 */
export const POST = route(async (request) => {
  const { user, sessionId } = await authenticate(request);
  await limit("write", user.id);
  const { token, platform } = await readJson(request, device);
  await db.pushDevice.upsert({
    where: { token },
    create: { token, platform, userId: user.id, sessionId },
    update: { platform, userId: user.id, sessionId },
  });
  return ok({ ok: true });
});

/** Tokenni o'chirish (bildirishnomalar o'chirildi). Faqat o'ziniki. */
export const DELETE = route(async (request) => {
  const { user } = await authenticate(request);
  const { token } = await readJson(request, device.pick({ token: true }));
  await db.pushDevice.deleteMany({ where: { token, userId: user.id } });
  return ok({ ok: true });
});
