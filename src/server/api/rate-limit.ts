import "server-only";
import { createHmac } from "node:crypto";
import { db } from "../db";
import { authSecret } from "../env";
import { ApiError } from "./http";
import { rateDecision } from "./rules";

/**
 * API so'rovlari chegarasi (`RateLimitHit` jadvali, SMS chegarasi bilan bir joyda; eskilari `pruneOtpData` bilan
 * tozalanadi — oyna 24 soatdan oshmasin). Kalitda IP/foydalanuvchi ochiq saqlanmaydi — HMAC.
 */
export const LIMITS = {
  verify: { max: 30, windowMs: 15 * 60_000 },
  login: { max: 30, windowMs: 15 * 60_000 },
  forgot: { max: 20, windowMs: 15 * 60_000 },
  password: { max: 20, windowMs: 15 * 60_000 },
  refresh: { max: 120, windowMs: 60 * 60_000 },
  register: { max: 10, windowMs: 60 * 60_000 },
  upload: { max: 30, windowMs: 60 * 60_000 },
  claim: { max: 30, windowMs: 10 * 60_000 },
  write: { max: 120, windowMs: 10 * 60_000 },
  scan: { max: 300, windowMs: 10 * 60_000 },
} as const;

export type LimitBucket = keyof typeof LIMITS;

export const limitKey = (bucket: LimitBucket, subject: string) =>
  `api:${bucket}:${createHmac("sha256", authSecret()).update(`api-limit:${subject}`).digest("hex").slice(0, 32)}`;

/** Chegara to'lgan bo'lsa `rate_limited` (+ `retryInSeconds`), aks holda urinish yoziladi. */
export async function limit(bucket: LimitBucket, subject: string, now = new Date()): Promise<void> {
  const retryInSeconds = await limitWait(bucket, subject, now);
  if (retryInSeconds !== null) throw new ApiError("rate_limited", { retryInSeconds });
}

/** `limit` ning xato tashlamaydigan ko'rinishi (sayt server action'lari uchun): chegara to'lgan bo'lsa — kutish soniyalari. */
export async function limitWait(bucket: LimitBucket, subject: string, now = new Date()): Promise<number | null> {
  const { max, windowMs } = LIMITS[bucket];
  const key = limitKey(bucket, subject);
  const hits = await db.rateLimitHit.findMany({ where: { key, createdAt: { gt: new Date(now.getTime() - windowMs) } }, select: { createdAt: true } });
  const decision = rateDecision(
    hits.map((h) => h.createdAt),
    now,
    max,
    windowMs,
  );
  if (!decision.ok) return Math.ceil(decision.retryInMs / 1000);
  await db.rateLimitHit.create({ data: { key } });
  return null;
}
