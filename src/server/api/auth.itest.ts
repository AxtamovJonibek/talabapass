import { createHash, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as code } from "@/app/api/v1/auth/code/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { POST as password } from "@/app/api/v1/auth/password/route";
import { POST as refresh } from "@/app/api/v1/auth/refresh/route";
import { POST as verify } from "@/app/api/v1/auth/verify/route";
import { DELETE as deleteMe, GET as me } from "@/app/api/v1/me/route";
import { hashOtp, rateLimitKeyForIp } from "../auth/otp-rules";
import { hashPassword } from "../auth/password";
import { db } from "../db";
import { authSecret } from "../env";
import { LIMITS, limitKey } from "./rate-limit";
import { seal } from "./rules";

// Faqat shu test ishlatadigan raqamlar va IP
const NEW_PHONE = "+998000000311";
const OLD_PHONE = "+998000000312";
const PW_PHONE = "+998000000313";
const BLOCKED_PHONE = "+998000000314";
const ADMIN_PHONE = "+998000000315";
const PHONES = [NEW_PHONE, OLD_PHONE, PW_PHONE, BLOCKED_PHONE, ADMIN_PHONE];
const IP = "198.51.100.31";
const PASSWORD = "parol1234";
const CODE = "482913";
const BUCKETS = ["verify", "login", "password", "refresh"] as const;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ctx = { params: Promise.resolve({}) };

function req(path: string, body?: unknown, token?: string, method = "POST") {
  const headers: Record<string, string> = { "x-real-ip": IP, "user-agent": "vitest" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function call(handler: (r: NextRequest, c: typeof ctx) => Promise<Response>, path: string, body?: unknown, token?: string, method?: string) {
  const res = await handler(req(path, body, token, method), ctx);
  return { status: res.status, headers: res.headers, json: (await res.json()) as Json };
}

/** Raqamga ma'lum kod (SMS o'rniga). */
async function issueCode(phone: string) {
  await db.otpCode.create({ data: { phone, codeHash: hashOtp(phone, CODE, authSecret()), expiresAt: new Date(Date.now() + 5 * 60_000) } });
}

async function verified(phone: string, intent = "student") {
  await issueCode(phone);
  return call(verify, "/api/v1/auth/verify", { phone, code: CODE, intent });
}

async function cleanup() {
  const users = await db.user.findMany({ where: { OR: [{ phone: { in: PHONES } }, { phone: { startsWith: "deleted:" }, firstName: "ApiTest" }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.otpCode.deleteMany({ where: { phone: { in: PHONES } } });
  await db.rateLimitHit.deleteMany({ where: { key: { in: [rateLimitKeyForIp(IP, authSecret()), ...BUCKETS.map((b) => limitKey(b, IP))] } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("API auth: kod so'rash", () => {
  it("xato format: { error: { code, message } }", async () => {
    const res = await call(code, "/api/v1/auth/code", { phone: "123" });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: { code: "invalid_phone", message: expect.any(String) } });
  });

  it("zod: noto'g'ri tana — invalid_request va maydonlar", async () => {
    const res = await call(verify, "/api/v1/auth/verify", { phone: 5 });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatchObject({ code: "invalid_request", fields: expect.arrayContaining(["phone", "code"]) });
  });

  it("raqam ro'yxatda bor-yo'qligi oshkor qilinmaydi (javob bir xil)", async () => {
    await db.user.create({ data: { phone: OLD_PHONE, role: "STUDENT", firstName: "ApiTest" } });
    const known = await call(code, "/api/v1/auth/code", { phone: OLD_PHONE });
    const unknown = await call(code, "/api/v1/auth/code", { phone: NEW_PHONE });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect({ ...known.json, phone: null }).toEqual({ ...unknown.json, phone: null });
  });

  it("60 soniya ichida qayta — too_soon, Retry-After bilan", async () => {
    await call(code, "/api/v1/auth/code", { phone: NEW_PHONE });
    const again = await call(code, "/api/v1/auth/code", { phone: NEW_PHONE });
    expect(again.status).toBe(429);
    expect(again.json.error).toMatchObject({ code: "too_soon", retryInSeconds: expect.any(Number) });
    expect(Number(again.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("API auth: yangi raqam", () => {
  it("kod → parol o'rnatish → ro'yxat tokeni (hisob hali ochilmaydi)", async () => {
    const v = await verified(NEW_PHONE);
    expect(v.json).toMatchObject({ next: "setPassword", isNew: true, role: "student", ticket: expect.any(String) });

    const weak = await call(password, "/api/v1/auth/password", { ticket: v.json.ticket, password: "qisqa", confirm: "qisqa" });
    expect(weak.json.error.code).toBe("weak_password");
    const mismatch = await call(password, "/api/v1/auth/password", { ticket: v.json.ticket, password: PASSWORD, confirm: "boshqa1234" });
    expect(mismatch.json.error.code).toBe("password_mismatch");

    const set = await call(password, "/api/v1/auth/password", { ticket: v.json.ticket, password: PASSWORD, confirm: PASSWORD });
    expect(set.status).toBe(200);
    expect(set.json).toMatchObject({ next: "register", role: "student", registrationTicket: expect.any(String) });
    expect(await db.user.count({ where: { phone: NEW_PHONE } })).toBe(0);
  });

  it("noto'g'ri kod — wrong_code; qadam tokenisiz parol o'rnatib bo'lmaydi", async () => {
    await issueCode(NEW_PHONE);
    const wrong = await call(verify, "/api/v1/auth/verify", { phone: NEW_PHONE, code: "000001", intent: "student" });
    expect(wrong.json.error.code).toBe("wrong_code");
    const access = seal("access", { sid: "x", uid: "y" }, 60_000, authSecret());
    const forged = await call(password, "/api/v1/auth/password", { ticket: access, password: PASSWORD, confirm: PASSWORD });
    expect(forged.status).toBe(401);
    expect(forged.json.error.code).toBe("step_expired");
  });
});

describe("API auth: mavjud hisob", () => {
  it("parolsiz eski hisob: parol o'rnatiladi va tokenlar beriladi", async () => {
    await db.user.create({ data: { phone: OLD_PHONE, role: "STUDENT", firstName: "ApiTest" } });
    const v = await verified(OLD_PHONE);
    expect(v.json).toMatchObject({ next: "setPassword", isNew: false });
    const set = await call(password, "/api/v1/auth/password", { ticket: v.json.ticket, password: PASSWORD, confirm: PASSWORD, deviceName: "Pixel 8" });
    expect(set.json).toMatchObject({ next: "signedIn", tokens: { tokenType: "Bearer" }, user: { phone: OLD_PHONE, role: "STUDENT", hasPassword: true } });

    const session = await db.session.findFirstOrThrow({ where: { user: { phone: OLD_PHONE } } });
    expect(session).toMatchObject({ kind: "API", deviceName: "Pixel 8", userAgent: "vitest" });
    // Bazada refresh token ochiq saqlanmaydi
    expect(session.tokenHash).not.toBe(set.json.tokens.refreshToken);

    // Shu qadam tokeni parol o'rnatilgach ishlamaydi
    const again = await call(password, "/api/v1/auth/password", { ticket: v.json.ticket, password: "yangi12345", confirm: "yangi12345" });
    expect(again.json.error.code).toBe("step_expired");
  });

  it("parol bilan kirish; xato parollar sanaladi, 5-sida qulf", async () => {
    await db.user.create({ data: { phone: PW_PHONE, role: "STUDENT", firstName: "ApiTest", passwordHash: hashPassword(PASSWORD) } });
    const v = await verified(PW_PHONE);
    expect(v.json).toMatchObject({ next: "password", masked: "+998 00 *** ** 13", initial: "A" });

    const wrong = await call(login, "/api/v1/auth/login", { ticket: v.json.ticket, password: "notogri123" });
    expect(wrong.status).toBe(401);
    expect(wrong.json.error).toMatchObject({ code: "wrong_password", left: 4 });

    const good = await call(login, "/api/v1/auth/login", { ticket: v.json.ticket, password: `  ${PASSWORD} ` });
    expect(good.status).toBe(200);
    expect(good.json.user.phone).toBe(PW_PHONE);

    for (let i = 0; i < 4; i++) await call(login, "/api/v1/auth/login", { ticket: v.json.ticket, password: "notogri123" });
    const fifth = await call(login, "/api/v1/auth/login", { ticket: v.json.ticket, password: "notogri123" });
    expect(fifth.json.error.code).toBe("password_locked");
    const evenRight = await call(login, "/api/v1/auth/login", { ticket: v.json.ticket, password: PASSWORD });
    expect(evenRight.json.error).toMatchObject({ code: "password_locked", retryInSeconds: expect.any(Number) });
  });

  it("parolni unutdim: SMS tasdig'i bilan yangi parol, eski sessiyalar yopiladi", async () => {
    await db.user.create({ data: { phone: PW_PHONE, role: "STUDENT", firstName: "ApiTest", passwordHash: hashPassword(PASSWORD) } });
    const first = await verified(PW_PHONE);
    const old = await call(login, "/api/v1/auth/login", { ticket: first.json.ticket, password: PASSWORD });

    await db.otpCode.deleteMany({ where: { phone: PW_PHONE } });
    const v = await verified(PW_PHONE);
    const reset = await call(password, "/api/v1/auth/password", { ticket: v.json.ticket, password: "yangi12345", confirm: "yangi12345" });
    expect(reset.json.next).toBe("signedIn");

    expect((await call(me, "/api/v1/me", undefined, old.json.tokens.accessToken, "GET")).status).toBe(401);
    expect((await call(me, "/api/v1/me", undefined, reset.json.tokens.accessToken, "GET")).status).toBe(200);
    // Eski parol endi o'tmaydi, eski qadam tokeni ham
    const stale = await call(login, "/api/v1/auth/login", { ticket: v.json.ticket, password: "yangi12345" });
    expect(stale.json.error.code).toBe("step_expired");
  });

  it("bloklangan hisob va admin API orqali kirmaydi", async () => {
    await db.user.create({ data: { phone: BLOCKED_PHONE, role: "STUDENT", firstName: "ApiTest", status: "BLOCKED" } });
    await db.user.create({ data: { phone: ADMIN_PHONE, role: "ADMIN", firstName: "ApiTest" } });
    expect((await verified(BLOCKED_PHONE)).json.error.code).toBe("account_blocked");
    expect((await verified(ADMIN_PHONE)).json.error.code).toBe("admin_not_supported");
  });
});

describe("API auth: tokenlar", () => {
  async function signIn() {
    await db.user.create({ data: { phone: PW_PHONE, role: "STUDENT", firstName: "ApiTest", passwordHash: hashPassword(PASSWORD) } });
    const v = await verified(PW_PHONE);
    return (await call(login, "/api/v1/auth/login", { ticket: v.json.ticket, password: PASSWORD })).json;
  }

  it("access token bilan /me; tokensiz yoki buzilgan — unauthorized", async () => {
    const { tokens } = await signIn();
    expect((await call(me, "/api/v1/me", undefined, tokens.accessToken, "GET")).json.user.phone).toBe(PW_PHONE);
    expect((await call(me, "/api/v1/me", undefined, undefined, "GET")).json.error.code).toBe("unauthorized");
    expect((await call(me, "/api/v1/me", undefined, `${tokens.accessToken}x`, "GET")).json.error.code).toBe("unauthorized");
  });

  it("muddati o'tgan access token — token_expired", async () => {
    const { tokens } = await signIn();
    const session = await db.session.findFirstOrThrow({ where: { user: { phone: PW_PHONE } } });
    const expired = seal("access", { sid: session.id, uid: session.userId }, 1, authSecret(), Date.now() - 60_000);
    expect((await call(me, "/api/v1/me", undefined, expired, "GET")).json.error.code).toBe("token_expired");
    expect(tokens.accessTokenExpiresAt > new Date().toISOString()).toBe(true);
  });

  it("refresh aylanadi; eski refresh qayta kelsa sessiya yopiladi", async () => {
    const { tokens } = await signIn();
    const first = await call(refresh, "/api/v1/auth/refresh", { refreshToken: tokens.refreshToken });
    expect(first.status).toBe(200);
    expect(first.json.tokens.refreshToken).not.toBe(tokens.refreshToken);
    expect((await call(me, "/api/v1/me", undefined, first.json.tokens.accessToken, "GET")).status).toBe(200);

    const reused = await call(refresh, "/api/v1/auth/refresh", { refreshToken: tokens.refreshToken });
    expect(reused.json.error.code).toBe("refresh_reused");
    // O'g'irlik belgisi: yangi juft ham o'ldi
    expect((await call(refresh, "/api/v1/auth/refresh", { refreshToken: first.json.tokens.refreshToken })).json.error.code).toBe("refresh_invalid");
    expect((await call(me, "/api/v1/me", undefined, first.json.tokens.accessToken, "GET")).status).toBe(401);
  });

  it("sayt sessiya cookie tokeni refresh sifatida ishlamaydi", async () => {
    const user = await db.user.create({ data: { phone: OLD_PHONE, role: "STUDENT", firstName: "ApiTest" } });
    const cookieToken = randomBytes(32).toString("base64url");
    await db.session.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(cookieToken).digest("hex"), expiresAt: new Date(Date.now() + 86_400_000) } });
    expect((await call(refresh, "/api/v1/auth/refresh", { refreshToken: cookieToken })).json.error.code).toBe("refresh_invalid");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("chiqish: sessiya o'chadi, refresh ham ishlamaydi", async () => {
    const { tokens } = await signIn();
    expect((await call(logout, "/api/v1/auth/logout", undefined, tokens.accessToken)).status).toBe(200);
    expect((await call(me, "/api/v1/me", undefined, tokens.accessToken, "GET")).status).toBe(401);
    expect((await call(refresh, "/api/v1/auth/refresh", { refreshToken: tokens.refreshToken })).json.error.code).toBe("refresh_invalid");
  });

  it("bloklash darhol kuchga kiradi (sessiyalar o'chiriladi)", async () => {
    const { tokens } = await signIn();
    // moderation.ts kabi: holat + sessiyalar
    await db.user.update({ where: { phone: PW_PHONE }, data: { status: "BLOCKED" } });
    expect((await call(me, "/api/v1/me", undefined, tokens.accessToken, "GET")).status).toBe(401);
    expect((await call(refresh, "/api/v1/auth/refresh", { refreshToken: tokens.refreshToken })).json.error.code).toBe("refresh_invalid");
  });

  it("hisobni o'chirish: parol bilan; raqam bo'shaydi, sessiyalar yopiladi", async () => {
    const { tokens } = await signIn();
    const wrong = await call(deleteMe, "/api/v1/me", { password: "notogri123" }, tokens.accessToken, "DELETE");
    expect(wrong.json.error.code).toBe("wrong_password");
    const done = await call(deleteMe, "/api/v1/me", { password: PASSWORD }, tokens.accessToken, "DELETE");
    expect(done.status).toBe(200);
    expect(await db.user.count({ where: { phone: PW_PHONE } })).toBe(0);
    const gone = await db.user.findFirstOrThrow({ where: { phone: { startsWith: "deleted:" }, auditLogs: { some: { action: "user.delete" } } }, orderBy: { updatedAt: "desc" } });
    expect(gone).toMatchObject({ status: "DELETED", firstName: null, passwordHash: null });
    expect(await db.session.count({ where: { userId: gone.id } })).toBe(0);
    await db.user.update({ where: { id: gone.id }, data: { firstName: "ApiTest" } }); // tozalash uchun belgi
    // Shu raqam bilan qaytadan — yangi raqam kabi
    expect((await verified(PW_PHONE)).json).toMatchObject({ next: "setPassword", isNew: true });
  });

  it(`kod tekshirish IP bo'yicha cheklangan (${LIMITS.verify.max} ta / 15 daqiqa)`, async () => {
    for (let i = 0; i < LIMITS.verify.max; i++) await call(verify, "/api/v1/auth/verify", {});
    const over = await call(verify, "/api/v1/auth/verify", { phone: NEW_PHONE, code: CODE });
    expect(over.status).toBe(429);
    expect(over.json.error.code).toBe("rate_limited");
  });
});
