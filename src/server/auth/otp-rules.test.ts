import { describe, expect, it } from "vitest";
import {
  canSendOtp,
  checkOtp,
  generateOtp,
  hashOtp,
  OTP_DAILY_LIMIT,
  OTP_IP_HOURLY_LIMIT,
  OTP_LOCK_MS,
  OTP_MAX_ATTEMPTS,
  rateLimitKeyForIp,
  shouldLock,
  type OtpRecord,
  type SendContext,
} from "./otp-rules";

const SECRET = "test-secret";
const PHONE = "+998904123785";
const now = new Date("2026-10-14T10:00:00Z");
const MIN = 60_000;
const ago = (ms: number) => new Date(now.getTime() - ms);
const inFuture = (ms: number) => new Date(now.getTime() + ms);

function record(code: string, overrides: Partial<OtpRecord> = {}): OtpRecord {
  return { codeHash: hashOtp(PHONE, code, SECRET), expiresAt: inFuture(MIN), attempts: 0, consumedAt: null, lockedUntil: null, ...overrides };
}
const ctx = (overrides: Partial<SendContext> = {}): SendContext => ({ phoneSentAt: [], ipRequestsAt: [], lockedUntil: null, ...overrides });

describe("generateOtp", () => {
  it("har doim 6 raqam", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe("xeshlar", () => {
  it("kod xeshi telefon va sirga bog'liq", () => {
    expect(hashOtp(PHONE, "123456", SECRET)).toBe(hashOtp(PHONE, "123456", SECRET));
    expect(hashOtp(PHONE, "123456", SECRET)).not.toBe(hashOtp("+998900000001", "123456", SECRET));
    expect(hashOtp(PHONE, "123456", SECRET)).not.toBe(hashOtp(PHONE, "123456", "boshqa"));
  });

  it("IP kalitida IP'ning o'zi yo'q", () => {
    const key = rateLimitKeyForIp("203.0.113.7", SECRET);
    expect(key).toMatch(/^otp-ip:[0-9a-f]{32}$/);
    expect(key).not.toContain("203");
    expect(key).toBe(rateLimitKeyForIp("203.0.113.7", SECRET));
    expect(key).not.toBe(rateLimitKeyForIp("203.0.113.8", SECRET));
  });
});

describe("canSendOtp — bitta raqam", () => {
  it("birinchi kod yuboriladi", () => {
    expect(canSendOtp(ctx(), now)).toEqual({ ok: true });
  });

  it("60 soniya o'tmaguncha qayta yuborilmaydi", () => {
    expect(canSendOtp(ctx({ phoneSentAt: [ago(20_000)] }), now)).toEqual({ ok: false, reason: "too_soon", retryInMs: 40_000 });
    expect(canSendOtp(ctx({ phoneSentAt: [ago(61_000)] }), now)).toEqual({ ok: true });
  });

  it(`kuniga ${OTP_DAILY_LIMIT} tadan ko'p SMS yuborilmaydi`, () => {
    const four = [1, 3, 6, 12].map((h) => ago(h * 60 * MIN));
    expect(canSendOtp(ctx({ phoneSentAt: four }), now)).toEqual({ ok: true });

    const five = [...four, ago(23 * 60 * MIN)];
    const decision = canSendOtp(ctx({ phoneSentAt: five }), now);
    expect(decision).toMatchObject({ ok: false, reason: "daily_limit" });
    // eng eski SMS 23 soat oldin — yana 1 soatdan keyin joy bo'shaydi
    expect(decision.ok ? 0 : decision.retryInMs).toBe(60 * MIN);
  });

  it("24 soatdan eski SMS'lar hisobga kirmaydi", () => {
    const sent = [2, 25, 30, 40, 50, 60].map((h) => ago(h * 60 * MIN));
    expect(canSendOtp(ctx({ phoneSentAt: sent }), now)).toEqual({ ok: true });
  });

  it("bloklangan raqamga kod yuborilmaydi, blok tugagach yuboriladi", () => {
    expect(canSendOtp(ctx({ lockedUntil: inFuture(10 * MIN) }), now)).toEqual({ ok: false, reason: "locked", retryInMs: 10 * MIN });
    expect(canSendOtp(ctx({ lockedUntil: ago(1) }), now)).toEqual({ ok: true });
  });
});

describe("canSendOtp — bitta IP", () => {
  const hits = (n: number) => Array.from({ length: n }, (_, i) => ago((i + 1) * 5 * MIN));

  it(`soatiga ${OTP_IP_HOURLY_LIMIT} ta so'rovgacha ruxsat`, () => {
    expect(canSendOtp(ctx({ ipRequestsAt: hits(OTP_IP_HOURLY_LIMIT - 1) }), now)).toEqual({ ok: true });
  });

  it(`${OTP_IP_HOURLY_LIMIT + 1}-so'rov rad etiladi — boshqa raqam bo'lsa ham`, () => {
    const decision = canSendOtp(ctx({ ipRequestsAt: hits(OTP_IP_HOURLY_LIMIT), phoneSentAt: [] }), now);
    expect(decision).toMatchObject({ ok: false, reason: "ip_limit" });
    // eng eski so'rov 50 daqiqa oldin — 10 daqiqadan keyin joy bo'shaydi
    expect(decision.ok ? 0 : decision.retryInMs).toBe(10 * MIN);
  });

  it("bir soatdan eski so'rovlar hisobga kirmaydi", () => {
    const old = Array.from({ length: 30 }, (_, i) => ago((61 + i) * MIN));
    expect(canSendOtp(ctx({ ipRequestsAt: old }), now)).toEqual({ ok: true });
  });

  it("IP chegarasi boshqa sabablardan oldin tekshiriladi", () => {
    const decision = canSendOtp(ctx({ ipRequestsAt: hits(OTP_IP_HOURLY_LIMIT), phoneSentAt: [ago(1000)], lockedUntil: inFuture(MIN) }), now);
    expect(decision).toMatchObject({ ok: false, reason: "ip_limit" });
  });
});

describe("checkOtp", () => {
  it("to'g'ri kod", () => {
    expect(checkOtp(record("481207"), PHONE, "481207", SECRET, now)).toBe("ok");
  });

  it("noto'g'ri kod va noto'g'ri format", () => {
    expect(checkOtp(record("481207"), PHONE, "481208", SECRET, now)).toBe("wrong");
    expect(checkOtp(record("481207"), PHONE, "48120", SECRET, now)).toBe("wrong");
    expect(checkOtp(record("481207"), PHONE, "48120a", SECRET, now)).toBe("wrong");
  });

  it("boshqa raqamga yuborilgan kod o'tmaydi", () => {
    expect(checkOtp(record("481207"), "+998900000001", "481207", SECRET, now)).toBe("wrong");
  });

  it("muddati o'tgan", () => {
    expect(checkOtp(record("481207", { expiresAt: ago(1) }), PHONE, "481207", SECRET, now)).toBe("expired");
  });

  it("ishlatilgan yoki yo'q kod", () => {
    expect(checkOtp(record("481207", { consumedAt: ago(1000) }), PHONE, "481207", SECRET, now)).toBe("no_code");
    expect(checkOtp(null, PHONE, "481207", SECRET, now)).toBe("no_code");
  });

  it(`${OTP_MAX_ATTEMPTS}-xato urinish chegarani to'ldiradi`, () => {
    expect(shouldLock(OTP_MAX_ATTEMPTS - 1)).toBe(false);
    expect(shouldLock(OTP_MAX_ATTEMPTS)).toBe(true);
  });

  it("chegara to'lgach to'g'ri kod ham o'tmaydi", () => {
    expect(checkOtp(record("481207", { attempts: OTP_MAX_ATTEMPTS }), PHONE, "481207", SECRET, now)).toBe("locked");
    expect(checkOtp(record("481207", { attempts: OTP_MAX_ATTEMPTS - 1 }), PHONE, "481207", SECRET, now)).toBe("ok");
  });

  it("blok davomida (15 daqiqa) to'g'ri kod ham rad etiladi, kod bekor bo'lgan", () => {
    const locked = record("481207", { attempts: OTP_MAX_ATTEMPTS, consumedAt: ago(1000), lockedUntil: inFuture(OTP_LOCK_MS) });
    expect(checkOtp(locked, PHONE, "481207", SECRET, now)).toBe("locked");
    // blok tugagach ham eski kod ishlamaydi — u bekor qilingan
    expect(checkOtp(locked, PHONE, "481207", SECRET, inFuture(OTP_LOCK_MS + 1))).toBe("no_code");
  });
});
