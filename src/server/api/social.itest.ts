import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as appleCallback } from "@/app/api/v1/auth/apple/callback/route";
import { POST as apple } from "@/app/api/v1/auth/apple/route";
import { GET as appleStart } from "@/app/api/v1/auth/apple/start/route";
import { POST as google } from "@/app/api/v1/auth/google/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as password } from "@/app/api/v1/auth/password/route";
import { POST as businessRegister } from "@/app/api/v1/business/register/route";
import { DELETE as deleteMe, GET as me } from "@/app/api/v1/me/route";
import { POST as studentRegister } from "@/app/api/v1/student/register/route";
import { db } from "../db";
import { stateOf } from "./apple-web";
import { limitKey } from "./rate-limit";
import type { SocialProfile } from "./social-token";

/*
 * Google/Apple bilan kirish (ilova). Provayder imzosi `social-token.test.ts` da tekshirilgan; bu yerda token tekshiruvi
 * almashtirilgan: "sub|email|verified" ko'rinishidagi soxta token → profil. Faqat oqim va baza: parol qadami, ro'yxat,
 * takror kirish, email bo'yicha bog'lash, bloklash, hisobni o'chirish.
 */
vi.mock("./social-token", async (original) => {
  const real = await original<typeof import("./social-token")>();
  return {
    ...real,
    verifySocialToken: vi.fn(async (provider: "GOOGLE" | "APPLE", idToken: string): Promise<SocialProfile> => {
      if (idToken.startsWith("unconfigured")) throw new real.SocialTokenError("unconfigured");
      if (idToken.startsWith("bad")) throw new real.SocialTokenError("invalid");
      const [subject, email, verified] = idToken.split("|");
      return { provider, subject: subject!, email: email || null, emailVerified: verified === "1", firstName: provider === "GOOGLE" ? "Gulnoza" : null, lastName: provider === "GOOGLE" ? "Testova" : null };
    }),
  };
});

const P = "itest-social-";
const EMAIL = "itest.social@example.uz";
const IP = "198.51.100.77";
const TIN = "900000777";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ctx = { params: Promise.resolve({}) };

function req(path: string, body?: unknown, { token, method = "POST" }: { token?: string; method?: string } = {}) {
  const headers: Record<string, string> = { "x-real-ip": IP };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function send(handler: (r: NextRequest, c: typeof ctx) => Promise<Response>, request: NextRequest) {
  const res = await handler(request, ctx);
  return { status: res.status, json: (await res.json()) as Json };
}

const idToken = (sub: string, email = "", verified = true) => `${P}${sub}|${email}|${verified ? "1" : "0"}`.padEnd(24, ".");

async function cleanup() {
  const identities = await db.authIdentity.findMany({ where: { subject: { startsWith: P } }, select: { userId: true } });
  const users = await db.user.findMany({ where: { OR: [{ email: { startsWith: "itest.social" } }, { id: { in: identities.map((i) => i.userId) } }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.business.deleteMany({ where: { OR: [{ ownerId: { in: ids } }, { tin: TIN }] } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.rateLimitHit.deleteMany({ where: { key: { in: [limitKey("verify", IP), limitKey("register", IP), limitKey("password", IP), limitKey("login", IP), ...ids.map((id) => limitKey("password", id))] } } });
}

const PASSWORD = "Sinov2026";

/** Google/Apple yangi foydalanuvchisi: parol qadami (majburiy) → ro'yxat tokeni. */
async function registrationTicket(result: { json: Json }) {
  expect(result.json).toMatchObject({ next: "setPassword", ticket: expect.any(String) });
  const set = await send(password, req("/api/v1/auth/password", { ticket: result.json.ticket, password: PASSWORD, confirm: PASSWORD }));
  expect(set.json.next).toBe("register");
  return set.json.registrationTicket as string;
}

async function university() {
  return db.university.findFirstOrThrow({ where: { active: true, kind: { not: "OTHER" } }, select: { id: true } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("API: Google/Apple bilan kirish", () => {
  it("yangi Google foydalanuvchi → parol (majburiy) → talaba ro'yxati (SMSsiz) → qayta kirish; email + parol bilan ham", async () => {
    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g1", EMAIL), intent: "student" }));
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ next: "setPassword", role: "student", profile: { firstName: "Gulnoza", lastName: "Testova", email: EMAIL } });
    // Parolsiz ro'yxat tokeni berilmaydi
    expect(first.json.registrationTicket).toBeUndefined();

    const { id: universityId } = await university();
    const body = { registrationTicket: await registrationTicket(first), firstName: "Gulnoza", lastName: "Testova", universityId, course: "C1" };
    const created = await send(studentRegister, req("/api/v1/student/register", body));
    expect(created.status).toBe(201);
    expect(created.json.user).toMatchObject({ role: "STUDENT", phone: null, email: EMAIL, hasPassword: true, mustSetPassword: false, student: { status: "DRAFT" } });
    const byEmail = await send(login, req("/api/v1/auth/login", { identifier: EMAIL, password: PASSWORD }));
    expect(byEmail.json.user?.id).toBe(created.json.user.id);

    // Bir ticket — bitta hisob
    expect((await send(studentRegister, req("/api/v1/student/register", body))).json.error.code).toBe("step_expired");

    const again = await send(google, req("/api/v1/auth/google", { idToken: idToken("g1", EMAIL), intent: "business" }));
    expect(again.json).toMatchObject({ next: "signedIn", user: { id: created.json.user.id, role: "STUDENT" } });
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: created.json.user.id, action: "user.login.ok" }, orderBy: { createdAt: "desc" } });
    expect(log.meta).toMatchObject({ method: "google", via: "api" });
    const view = await send(me, req("/api/v1/me", undefined, { token: again.json.tokens.accessToken, method: "GET" }));
    expect(view.json.user).toMatchObject({ phone: null, email: EMAIL });
  });

  it("bir xil tasdiqlangan email — bitta hisob (Apple Google hisobiga bog'lanadi); tasdiqlanmagani bog'lanmaydi", async () => {
    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g2", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: await registrationTicket(first), firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    const userId = created.json.user.id as string;

    const unverified = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a-unverified", EMAIL, false) }));
    expect(unverified.json.next).toBe("setPassword");
    expect(unverified.json.profile.email).toBeNull();

    const linked = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a2", EMAIL), firstName: "Ali" }));
    expect(linked.json).toMatchObject({ next: "signedIn", user: { id: userId } });
    expect(await db.authIdentity.count({ where: { userId } })).toBe(2);
    expect(await db.auditLog.count({ where: { actorId: userId, action: "user.identity.link" } })).toBe(1);
  });

  it("Apple: ism mijozdan (tokenda yo'q); biznes ro'yxati — contactPhone yo'q", async () => {
    const first = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a3"), intent: "business", firstName: "Bekzod", lastName: "Karimov" }));
    expect(first.json).toMatchObject({ next: "setPassword", role: "business", profile: { firstName: "Bekzod", lastName: "Karimov", email: null } });
    // Talaba ticketi biznesga o'tmaydi
    const info = { name: "Itest Kofe", kind: "CAFE", address: "Toshkent, Chilonzor 9", workingHours: "09:00 – 22:00", tin: TIN, contactName: "Bekzod Karimov" };
    const created = await send(businessRegister, req("/api/v1/business/register", { registrationTicket: await registrationTicket(first), ...info }));
    expect(created.status).toBe(201);
    expect(created.json.user).toMatchObject({ role: "BUSINESS_OWNER", phone: null, email: null, business: { name: "Itest Kofe", submitted: false } });
    expect(await db.business.findFirst({ where: { tin: TIN }, select: { contactPhone: true } })).toEqual({ contactPhone: null });
  });

  it("xatolar: client ID yo'q — 503, buzilgan token — 401, bloklangan hisob — kirmaydi", async () => {
    expect(await send(apple, req("/api/v1/auth/apple", { idToken: "unconfigured-token-0000000" }))).toMatchObject({ status: 503, json: { error: { code: "social_unavailable" } } });
    expect(await send(google, req("/api/v1/auth/google", { idToken: "bad-token-000000000000000" }))).toMatchObject({ status: 401, json: { error: { code: "social_invalid" } } });

    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g4", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: await registrationTicket(first), firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    await db.user.update({ where: { id: created.json.user.id }, data: { status: "BLOCKED" } });
    expect((await send(google, req("/api/v1/auth/google", { idToken: idToken("g4", EMAIL) }))).json.error.code).toBe("account_blocked");
  });

  it("parolsiz (eski) Google hisob: ichkarida parol so'raladi; o'chirish — o'sha provayder tokeni bilan; keyin yangi hisob", async () => {
    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g5", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: await registrationTicket(first), firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    // Parol majburiy bo'lgunga qadar ochilgan eski hisob
    await db.user.update({ where: { id: created.json.user.id }, data: { passwordHash: null } });
    const signedIn = await send(google, req("/api/v1/auth/google", { idToken: idToken("g5", EMAIL) }));
    expect(signedIn.json.user).toMatchObject({ hasPassword: false, mustSetPassword: true });
    const token = signedIn.json.tokens.accessToken as string;

    expect((await send(deleteMe, req("/api/v1/me", {}, { token, method: "DELETE" }))).json.error.code).toBe("password_required");
    expect((await send(deleteMe, req("/api/v1/me", { provider: "GOOGLE", idToken: idToken("begona", EMAIL) }, { token, method: "DELETE" }))).json.error.code).toBe("social_mismatch");
    expect(await send(deleteMe, req("/api/v1/me", { provider: "GOOGLE", idToken: idToken("g5", EMAIL) }, { token, method: "DELETE" }))).toMatchObject({ status: 200, json: { ok: true } });

    const gone = await db.user.findUniqueOrThrow({ where: { id: created.json.user.id }, select: { status: true, email: true, _count: { select: { identities: true } } } });
    expect(gone).toEqual({ status: "DELETED", email: null, _count: { identities: 0 } });
    expect((await send(google, req("/api/v1/auth/google", { idToken: idToken("g5", EMAIL) }))).json.next).toBe("setPassword");
  });

  it("Apple web oqimi (Android): start → form_post callback → ticket + verifier bilan kirish va hisobni o'chirish", async () => {
    const verifier = "a".repeat(30) + "B1_-" + "c".repeat(30);
    const state = stateOf(verifier);
    const android = "Mozilla/5.0 (Linux; Android 14) Chrome/130";

    // Services ID yo'q — ilovaga xato bilan qaytadi; bor — Apple sahifasiga
    const prev = process.env.APPLE_CLIENT_ID;
    process.env.APPLE_CLIENT_ID = "uz.talabapass.app";
    const off = await appleStart(new NextRequest(`http://localhost/api/v1/auth/apple/start?state=${state}`, { headers: { "user-agent": android } }), ctx);
    expect(off.headers.get("location")).toBe("intent://auth/apple?error=unavailable#Intent;scheme=talabapass;package=uz.talabapass.app;end");
    process.env.APPLE_CLIENT_ID = "uz.talabapass.app,uz.talabapass.signin";
    const on = await appleStart(new NextRequest(`http://localhost/api/v1/auth/apple/start?state=${state}`), ctx);
    expect(new URL(on.headers.get("location")!).searchParams.get("client_id")).toBe("uz.talabapass.signin");
    process.env.APPLE_CLIENT_ID = prev;

    const form = (fields: Record<string, string>) =>
      new NextRequest("http://localhost/api/v1/auth/apple/callback", { method: "POST", headers: { "user-agent": android, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields).toString() });
    const cancelled = await appleCallback(form({ error: "user_cancelled_authorize", state }), ctx);
    expect(cancelled.status).toBe(303);
    expect(cancelled.headers.get("location")).toContain("error=cancelled");

    const back = await appleCallback(form({ state, id_token: idToken("a-web", ""), user: JSON.stringify({ name: { firstName: "Olim", lastName: "Webov" } }) }), ctx);
    const ticket = new URL(back.headers.get("location")!.replace(/^intent:/, "https:").replace(/#Intent.*$/, "")).searchParams.get("ticket")!;
    expect(ticket.length).toBeGreaterThan(40);

    // Boshqa verifier (deep link'ni ushlagan ilova) — o'tmaydi
    expect((await send(apple, req("/api/v1/auth/apple", { ticket, verifier: verifier.replace("B", "C") }))).json.error.code).toBe("social_invalid");
    const first = await send(apple, req("/api/v1/auth/apple", { ticket, verifier }));
    expect(first.json).toMatchObject({ next: "setPassword", role: "student", profile: { firstName: "Olim", lastName: "Webov" } });

    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: await registrationTicket(first), firstName: "Olim", lastName: "Webov", universityId, course: "C1" }));
    const token = created.json.tokens.accessToken as string;
    const again = await appleCallback(form({ state, id_token: idToken("a-web", "") }), ctx);
    const ticket2 = new URL(again.headers.get("location")!.replace(/^intent:/, "https:").replace(/#Intent.*$/, "")).searchParams.get("ticket")!;
    // Parolli hisob — parol bilan (provayder tokeni yetmaydi)
    expect((await send(deleteMe, req("/api/v1/me", { provider: "APPLE", ticket: ticket2, verifier }, { token, method: "DELETE" }))).json.error.code).toBe("password_required");
    expect(await send(deleteMe, req("/api/v1/me", { password: PASSWORD }, { token, method: "DELETE" }))).toMatchObject({ status: 200, json: { ok: true } });
  });
});

