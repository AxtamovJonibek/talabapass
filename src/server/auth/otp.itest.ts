import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { authSecret } from "../env";
import { requestOtp, verifyOtp } from "./otp";
import { hashOtp, OTP_DAILY_LIMIT, OTP_IP_HOURLY_LIMIT, OTP_LOCK_MS, OTP_MAX_ATTEMPTS, rateLimitKeyForIp } from "./otp-rules";

// Faqat testlar ishlatadigan raqamlar va IP'lar
const PHONE = "+998000000101";
const OTHER_PHONE = "+998000000102";
const IP = "198.51.100.10";
const OTHER_IP = "198.51.100.11";
const sms = (code: string) => `test ${code}`;
const MIN = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms);

async function cleanup() {
  await db.otpCode.deleteMany({ where: { phone: { in: [PHONE, OTHER_PHONE] } } });
  await db.rateLimitHit.deleteMany({ where: { key: { in: [IP, OTHER_IP].map((ip) => rateLimitKeyForIp(ip, authSecret())) } } });
}

/** Ma'lum kodli yozuvni to'g'ridan-to'g'ri yaratadi (yuborilgan kodni bilish uchun). */
async function issue(phone: string, code: string, createdAt = new Date()) {
  return db.otpCode.create({
    data: { phone, codeHash: hashOtp(phone, code, authSecret()), expiresAt: new Date(createdAt.getTime() + 5 * MIN), createdAt },
  });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("SMS chegaralari (baza bilan)", () => {
  it("birinchi so'rov o'tadi va kod yaratiladi", async () => {
    expect(await requestOtp(PHONE, IP, sms)).toEqual({ ok: true });
    expect(await db.otpCode.count({ where: { phone: PHONE } })).toBe(1);
  });

  it("60 soniya ichida ikkinchi SMS yuborilmaydi", async () => {
    await requestOtp(PHONE, IP, sms);
    expect(await requestOtp(PHONE, IP, sms)).toMatchObject({ ok: false, reason: "too_soon" });
    expect(await db.otpCode.count({ where: { phone: PHONE } })).toBe(1);
  });

  it(`bitta raqamga kuniga ${OTP_DAILY_LIMIT} ta SMS: ${OTP_DAILY_LIMIT + 1}-si rad etiladi`, async () => {
    for (let i = 0; i < OTP_DAILY_LIMIT - 1; i++) await issue(PHONE, "111111", ago((i + 2) * 60 * MIN));
    // 5-SMS hali o'tadi…
    expect(await requestOtp(PHONE, IP, sms)).toEqual({ ok: true });
    // …6-si — yo'q (60 soniya o'tgan deb hisoblash uchun oxirgi kodni orqaga suramiz)
    await db.otpCode.updateMany({ where: { phone: PHONE, createdAt: { gt: ago(MIN) } }, data: { createdAt: ago(2 * MIN) } });
    expect(await requestOtp(PHONE, OTHER_IP, sms)).toMatchObject({ ok: false, reason: "daily_limit" });
    expect(await db.otpCode.count({ where: { phone: PHONE } })).toBe(OTP_DAILY_LIMIT);
  });

  it("kunlik chegara boshqa raqamga ta'sir qilmaydi", async () => {
    for (let i = 0; i < OTP_DAILY_LIMIT; i++) await issue(PHONE, "111111", ago((i + 2) * 60 * MIN));
    expect(await requestOtp(OTHER_PHONE, IP, sms)).toEqual({ ok: true });
  });

  it(`bitta IP'dan soatiga ${OTP_IP_HOURLY_LIMIT} ta so'rov: keyingisi rad etiladi, raqam boshqa bo'lsa ham`, async () => {
    const key = rateLimitKeyForIp(IP, authSecret());
    await db.rateLimitHit.createMany({ data: Array.from({ length: OTP_IP_HOURLY_LIMIT - 1 }, (_, i) => ({ key, createdAt: ago((i + 1) * MIN) })) });

    expect(await requestOtp(PHONE, IP, sms)).toEqual({ ok: true }); // 10-so'rov
    expect(await requestOtp(OTHER_PHONE, IP, sms)).toMatchObject({ ok: false, reason: "ip_limit" }); // 11-si
    expect(await db.otpCode.count({ where: { phone: OTHER_PHONE } })).toBe(0);
    // boshqa IP'dan o'sha raqamga yuborish mumkin
    expect(await requestOtp(OTHER_PHONE, OTHER_IP, sms)).toEqual({ ok: true });
  });

  it("rad etilgan so'rovlar ham IP hisobiga yoziladi", async () => {
    await requestOtp(PHONE, IP, sms);
    await requestOtp(PHONE, IP, sms); // too_soon
    await requestOtp(PHONE, IP, sms); // too_soon
    expect(await db.rateLimitHit.count({ where: { key: rateLimitKeyForIp(IP, authSecret()) } })).toBe(3);
  });

  it("bir soatdan eski IP so'rovlari hisobga kirmaydi", async () => {
    const key = rateLimitKeyForIp(IP, authSecret());
    await db.rateLimitHit.createMany({ data: Array.from({ length: 20 }, (_, i) => ({ key, createdAt: ago((61 + i) * MIN) })) });
    expect(await requestOtp(PHONE, IP, sms)).toEqual({ ok: true });
  });

  it("IP bazada ochiq saqlanmaydi", async () => {
    await requestOtp(PHONE, IP, sms);
    const hits = await db.rateLimitHit.findMany({ where: { createdAt: { gt: ago(MIN) } } });
    expect(hits.some((h) => h.key.includes(IP))).toBe(false);
  });
});

describe("kodni tekshirish (baza bilan)", () => {
  it("to'g'ri kod bir marta o'tadi, ikkinchi marta — yo'q", async () => {
    await issue(PHONE, "481207");
    expect(await verifyOtp(PHONE, "481207")).toBe("ok");
    expect(await verifyOtp(PHONE, "481207")).toBe("no_code");
  });

  it(`${OTP_MAX_ATTEMPTS} ta noto'g'ri urinish: kod bekor bo'ladi va raqam 15 daqiqaga bloklanadi`, async () => {
    const record = await issue(PHONE, "481207");
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) expect(await verifyOtp(PHONE, "000001"), `${i}-urinish`).toBe("wrong");
    expect(await verifyOtp(PHONE, "000001"), "5-urinish").toBe("locked");

    const after = await db.otpCode.findUniqueOrThrow({ where: { id: record.id } });
    expect(after.attempts).toBe(OTP_MAX_ATTEMPTS);
    expect(after.consumedAt).not.toBeNull(); // kod bekor qilingan
    const lockMs = after.lockedUntil!.getTime() - Date.now();
    expect(lockMs).toBeGreaterThan(OTP_LOCK_MS - 5000);
    expect(lockMs).toBeLessThanOrEqual(OTP_LOCK_MS);

    // blok davomida to'g'ri kod ham, yangi kod so'rash ham ishlamaydi
    expect(await verifyOtp(PHONE, "481207")).toBe("locked");
    expect(await requestOtp(PHONE, IP, sms)).toMatchObject({ ok: false, reason: "locked" });
    expect(await db.otpCode.count({ where: { phone: PHONE } })).toBe(1);
  });

  it("blok tugagach: eski kod ishlamaydi, yangi kod olish mumkin", async () => {
    await issue(PHONE, "481207", ago(2 * MIN));
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await verifyOtp(PHONE, "000001");
    await db.otpCode.updateMany({ where: { phone: PHONE }, data: { lockedUntil: ago(1000) } });

    expect(await verifyOtp(PHONE, "481207")).toBe("no_code");
    expect(await requestOtp(PHONE, IP, sms)).toEqual({ ok: true });
  });

  it("blok boshqa raqamga ta'sir qilmaydi", async () => {
    await issue(PHONE, "481207");
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await verifyOtp(PHONE, "000001");
    await issue(OTHER_PHONE, "123123");
    expect(await verifyOtp(OTHER_PHONE, "123123")).toBe("ok");
  });

  it("4 ta xatodan keyin to'g'ri kod hali o'tadi", async () => {
    await issue(PHONE, "481207");
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) await verifyOtp(PHONE, "000001");
    expect(await verifyOtp(PHONE, "481207")).toBe("ok");
  });

  it("muddati o'tgan kod rad etiladi", async () => {
    await issue(PHONE, "481207", ago(6 * MIN));
    expect(await verifyOtp(PHONE, "481207")).toBe("expired");
  });

  it("bir vaqtda kelgan ikki to'g'ri so'rovdan faqat bittasi o'tadi", async () => {
    await issue(PHONE, "481207");
    const results = await Promise.all([verifyOtp(PHONE, "481207"), verifyOtp(PHONE, "481207")]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
  });
});
