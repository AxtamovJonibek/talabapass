import "server-only";
import { db } from "../db";
import { authSecret, fixedOtpForDev } from "../env";
import { sendSms } from "../sms";
import {
  canSendOtp,
  checkOtp,
  generateOtp,
  hashOtp,
  OTP_LOCK_MS,
  OTP_TTL_MS,
  rateLimitKeyForIp,
  shouldLock,
  type SendDecision,
  type VerifyDecision,
} from "./otp-rules";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Raqamga yangi kod yuboradi. Chegaralar: bitta IP'dan soatiga 10 ta so'rov, bitta raqamga 60 soniyada 1 ta
 * va kuniga 5 ta SMS, xato urinishlardan keyingi 15 daqiqalik blok. Har bir so'rov (rad etilgani ham) IP hisobiga yoziladi.
 */
export async function requestOtp(phone: string, ip: string, smsText: (code: string) => string): Promise<SendDecision> {
  const now = new Date();
  const ipKey = rateLimitKeyForIp(ip, authSecret());

  const ipHits = await db.rateLimitHit.findMany({
    where: { key: ipKey, createdAt: { gt: new Date(now.getTime() - HOUR_MS) } },
    select: { createdAt: true },
  });
  const sent = await db.otpCode.findMany({
    where: { phone, createdAt: { gt: new Date(now.getTime() - DAY_MS) } },
    select: { createdAt: true },
  });
  const lock = await db.otpCode.findFirst({
    where: { phone, lockedUntil: { gt: now } },
    orderBy: { lockedUntil: "desc" },
    select: { lockedUntil: true },
  });

  const decision = canSendOtp(
    { ipRequestsAt: ipHits.map((h) => h.createdAt), phoneSentAt: sent.map((s) => s.createdAt), lockedUntil: lock?.lockedUntil ?? null },
    now,
  );
  // IP chegarasi to'lgan bo'lsa yozuv qo'shilmaydi — aks holda hujumchi o'z blokini cheksiz uzaytirib, jadvalni to'ldiradi.
  if (decision.ok || decision.reason !== "ip_limit") {
    await db.rateLimitHit.create({ data: { key: ipKey } });
  }
  if (!decision.ok) return decision;

  const code = fixedOtpForDev() ?? generateOtp();
  await db.otpCode.create({
    data: { phone, codeHash: hashOtp(phone, code, authSecret()), expiresAt: new Date(now.getTime() + OTP_TTL_MS) },
  });
  await sendSms(phone, smsText(code));
  return decision;
}

/**
 * Kodni tekshiradi. To'g'ri bo'lsa bir martalik sifatida yopadi. Xato bo'lsa urinishlar sonini oshiradi;
 * 5-xatoda kod bekor qilinadi va raqam 15 daqiqaga bloklanadi.
 */
export async function verifyOtp(phone: string, code: string): Promise<VerifyDecision> {
  const now = new Date();
  // Blok eng oxirgi kodda bo'lmasligi ham mumkin — alohida qaraladi.
  const locked = await db.otpCode.findFirst({ where: { phone, lockedUntil: { gt: now } }, select: { id: true } });
  if (locked) return "locked";

  const record = await db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  const decision = checkOtp(record, phone, code, authSecret(), now);
  if (!record) return decision;

  if (decision === "ok") {
    // Poyga holati: ikki so'rov bir vaqtda kelsa faqat bittasi yopa oladi.
    const closed = await db.otpCode.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: now } });
    return closed.count === 1 ? "ok" : "no_code";
  }
  if (decision === "wrong") {
    const updated = await db.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
    if (shouldLock(updated.attempts)) {
      await db.otpCode.update({ where: { id: record.id }, data: { consumedAt: now, lockedUntil: new Date(now.getTime() + OTP_LOCK_MS) } });
      return "locked";
    }
  }
  return decision;
}

/** Eskirgan hisob yozuvlarini tozalaydi (cron'dan chaqiriladi). */
export async function pruneOtpData(now = new Date()): Promise<void> {
  await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY_MS) } } });
  await db.otpCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * DAY_MS) } } });
}
