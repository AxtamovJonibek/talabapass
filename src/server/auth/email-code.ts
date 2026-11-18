import "server-only";
import { db } from "../db";
import { authSecret, fixedOtpForDev } from "../env";
import { canSendOtp, checkOtp, generateOtp, hashOtp, rateLimitKeyForIp, shouldLock, type SendDecision, type VerifyDecision } from "./otp-rules";

/**
 * "Parolni unutdim" — emailga 6 raqamli kod. SMS kodi qoidalari bilan bir xil (`otp-rules.ts`): manzilga 60 soniyada 1 ta,
 * kuniga 5 ta, IP'dan soatiga 10 ta (SMS bilan umumiy hisob); farqi — 10 daqiqa amal qiladi va 5 ta xatodan keyin kod
 * bekor bo'ladi (manzil bloklanmaydi — yangi kod olinadi). Bazada faqat HMAC.
 */
export const EMAIL_CODE_TTL_MS = 10 * 60_000;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Kod yaratib `send` bilan yuboradi (yuborish xato bersa — yozuv qoladi, foydalanuvchi qayta so'raydi). */
export async function requestEmailCode(email: string, ip: string, send: (code: string) => Promise<void>, now = new Date()): Promise<SendDecision> {
  const ipKey = rateLimitKeyForIp(ip, authSecret());
  const [ipHits, sent] = await Promise.all([
    db.rateLimitHit.findMany({ where: { key: ipKey, createdAt: { gt: new Date(now.getTime() - HOUR_MS) } }, select: { createdAt: true } }),
    db.emailCode.findMany({ where: { email, createdAt: { gt: new Date(now.getTime() - DAY_MS) } }, select: { createdAt: true } }),
  ]);
  const decision = canSendOtp({ ipRequestsAt: ipHits.map((h) => h.createdAt), phoneSentAt: sent.map((s) => s.createdAt), lockedUntil: null }, now);
  if (decision.ok || decision.reason !== "ip_limit") await db.rateLimitHit.create({ data: { key: ipKey } });
  if (!decision.ok) return decision;

  const code = fixedOtpForDev() ?? generateOtp();
  await db.emailCode.create({ data: { email, codeHash: hashOtp(`email:${email}`, code, authSecret()), expiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MS) } });
  await send(code);
  return decision;
}

/** Oxirgi kod bilan solishtiradi; to'g'ri bo'lsa bir martalik yopiladi, 5-xatoda bekor qilinadi ("locked"). */
export async function verifyEmailCode(email: string, code: string, now = new Date()): Promise<VerifyDecision> {
  const record = await db.emailCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  const decision = checkOtp(record && { ...record, lockedUntil: null }, `email:${email}`, code, authSecret(), now);
  if (!record) return decision;
  if (decision === "ok") {
    const closed = await db.emailCode.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: now } });
    return closed.count === 1 ? "ok" : "no_code";
  }
  if (decision === "wrong") {
    const updated = await db.emailCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
    if (shouldLock(updated.attempts)) {
      await db.emailCode.update({ where: { id: record.id }, data: { consumedAt: now } });
      return "locked";
    }
  }
  return decision;
}
