import "server-only";
import { db } from "../db";
import { authSecret, fixedOtpForDev } from "../env";
import { sendSms } from "../sms";
import { canSendOtp, checkOtp, generateOtp, hashOtp, OTP_TTL_MS, type SendDecision, type VerifyDecision } from "./otp-rules";

/** Raqamga yangi kod yuboradi (chegaralar: 60 soniyada 1 ta, soatiga 5 ta). */
export async function requestOtp(phone: string, smsText: (code: string) => string): Promise<SendDecision> {
  const now = new Date();
  const recent = await db.otpCode.findMany({
    where: { phone, createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
    select: { createdAt: true },
  });
  const decision = canSendOtp(recent.map((r) => r.createdAt), now);
  if (!decision.ok) return decision;

  const code = fixedOtpForDev() ?? generateOtp();
  await db.otpCode.create({
    data: { phone, codeHash: hashOtp(phone, code, authSecret()), expiresAt: new Date(now.getTime() + OTP_TTL_MS) },
  });
  await sendSms(phone, smsText(code));
  return decision;
}

/** Kodni tekshiradi. To'g'ri bo'lsa bir martalik sifatida yopadi; xato bo'lsa urinishlar sonini oshiradi. */
export async function verifyOtp(phone: string, code: string): Promise<VerifyDecision> {
  const record = await db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  const decision = checkOtp(record, phone, code, authSecret(), new Date());
  if (!record) return decision;

  if (decision === "ok") {
    // Poyga holati: ikki so'rov bir vaqtda kelsa faqat bittasi yopa oladi.
    const closed = await db.otpCode.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: new Date() } });
    return closed.count === 1 ? "ok" : "no_code";
  }
  if (decision === "wrong") {
    await db.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
  }
  return decision;
}
