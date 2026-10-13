import { describe, expect, it } from "vitest";
import { canSendOtp, checkOtp, generateOtp, hashOtp, OTP_MAX_ATTEMPTS, type OtpRecord } from "./otp-rules";

const SECRET = "test-secret";
const PHONE = "+998904123785";
const now = new Date("2026-10-14T10:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

function record(code: string, overrides: Partial<OtpRecord> = {}): OtpRecord {
  return { codeHash: hashOtp(PHONE, code, SECRET), expiresAt: new Date(now.getTime() + 60_000), attempts: 0, consumedAt: null, ...overrides };
}

describe("generateOtp", () => {
  it("har doim 6 raqam", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe("hashOtp", () => {
  it("telefon va sirga bog'liq", () => {
    expect(hashOtp(PHONE, "123456", SECRET)).toBe(hashOtp(PHONE, "123456", SECRET));
    expect(hashOtp(PHONE, "123456", SECRET)).not.toBe(hashOtp("+998900000001", "123456", SECRET));
    expect(hashOtp(PHONE, "123456", SECRET)).not.toBe(hashOtp(PHONE, "123456", "boshqa"));
  });
});

describe("canSendOtp", () => {
  it("birinchi kod yuboriladi", () => {
    expect(canSendOtp([], now)).toEqual({ ok: true });
  });

  it("60 soniya o'tmaguncha qayta yuborilmaydi", () => {
    expect(canSendOtp([ago(20_000)], now)).toEqual({ ok: false, reason: "too_soon", retryInMs: 40_000 });
    expect(canSendOtp([ago(61_000)], now)).toEqual({ ok: true });
  });

  it("soatiga 5 tadan ko'p emas", () => {
    const sent = [2, 10, 20, 30, 40].map((min) => ago(min * 60_000));
    const decision = canSendOtp(sent, now);
    expect(decision).toMatchObject({ ok: false, reason: "hourly_limit" });
    // eng eski kod 40 daqiqa oldin — yana 20 daqiqadan keyin mumkin
    expect(decision.ok ? 0 : decision.retryInMs).toBe(20 * 60_000);
  });

  it("bir soatdan eski kodlar hisobga kirmaydi", () => {
    const sent = [2, 61, 70, 80, 90, 100].map((min) => ago(min * 60_000));
    expect(canSendOtp(sent, now)).toEqual({ ok: true });
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

  it("5 ta xato urinishdan keyin to'g'ri kod ham o'tmaydi", () => {
    expect(checkOtp(record("481207", { attempts: OTP_MAX_ATTEMPTS }), PHONE, "481207", SECRET, now)).toBe("locked");
    expect(checkOtp(record("481207", { attempts: OTP_MAX_ATTEMPTS - 1 }), PHONE, "481207", SECRET, now)).toBe("ok");
  });
});
