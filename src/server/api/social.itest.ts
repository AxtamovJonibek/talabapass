import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as appleCallback } from "@/app/api/v1/auth/apple/callback/route";
import { POST as apple } from "@/app/api/v1/auth/apple/route";
import { GET as appleStart } from "@/app/api/v1/auth/apple/start/route";
import { POST as google } from "@/app/api/v1/auth/google/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as setPassword } from "@/app/api/v1/auth/password/route";
import { POST as signin } from "@/app/api/v1/auth/signin/route";
import { POST as businessRegister } from "@/app/api/v1/business/register/route";
import { DELETE as deleteMe, GET as me } from "@/app/api/v1/me/route";
import { POST as studentRegister } from "@/app/api/v1/student/register/route";
import { db } from "../db";
import { stateOf } from "./apple-web";
import { limitKey } from "./rate-limit";
import type { SocialProfile } from "./social-token";

/*
 * Google/Apple bilan kirish (ilova). Provayder imzosi `social-token.test.ts` da tekshirilgan; bu yerda token tekshiruvi
 * almashtirilgan: "sub|email|verified" ko'rinishidagi soxta token → profil. Faqat oqim va baza: ro'yxat, takror kirish,
 * email bo'yicha bog'lash, bloklash, hisobni o'chirish.
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

const PASSWORD = "Parol1234";
/** Google/Apple: parol ma'lumotlardan oldin — ro'yxat tokeniga xesh yoziladi */
async function withPassword(ticket: string) {
  const res = await send(setPassword, req("/api/v1/auth/password", { ticket, password: PASSWORD, confirm: PASSWORD }));
  expect(res.json.next).toBe("register");
  return res.json.registrationTicket as string;
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

async function university() {
  return db.university.findFirstOrThrow({ where: { active: true, kind: { not: "OTHER" } }, select: { id: true } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("API: Google/Apple bilan kirish", () => {
  it("yangi Google foydalanuvchi → SMS/parolsiz talaba ro'yxati → qayta kirish", async () => {
    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g1", EMAIL), intent: "student" }));
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ next: "register", role: "student", profile: { firstName: "Gulnoza", lastName: "Testova", email: EMAIL } });

    const { id: universityId } = await university();
    const noPassword = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: first.json.registrationTicket, firstName: "Gulnoza", lastName: "Testova", universityId, course: "C1" }));
    expect(noPassword.json.error.code).toBe("password_required");
    const body = { registrationTicket: await withPassword(first.json.registrationTicket), firstName: "Gulnoza", lastName: "Testova", universityId, course: "C1" };
    const created = await send(studentRegister, req("/api/v1/student/register", body));
    expect(created.status).toBe(201);
    expect(created.json.user).toMatchObject({ role: "STUDENT", phone: null, email: EMAIL, hasPassword: true, student: { status: "DRAFT" } });

    // Bir ticket — bitta hisob
    expect((await send(studentRegister, req("/api/v1/student/register", body))).json.error.code).toBe("step_expired");

    // Qayta kirish: SMS yo'q, o'sha hisobning paroli so'raladi
    const asked = await send(google, req("/api/v1/auth/google", { idToken: idToken("g1", EMAIL), intent: "business" }));
    expect(asked.json).toMatchObject({ next: "password", role: "student", masked: EMAIL });
    expect((await send(login, req("/api/v1/auth/login", { ticket: asked.json.ticket, password: "Notogri1" }))).json.error.code).toBe("wrong_password");
    const again = await send(login, req("/api/v1/auth/login", { ticket: asked.json.ticket, password: PASSWORD }));
    expect(again.json).toMatchObject({ user: { id: created.json.user.id, role: "STUDENT" } });
    // Email + parol bilan ham kiradi; noto'g'ri parol yoki noma'lum email — bir xil xato
    expect((await send(signin, req("/api/v1/auth/signin", { identifier: EMAIL.toUpperCase(), password: PASSWORD }))).json.user.id).toBe(created.json.user.id);
    expect((await send(signin, req("/api/v1/auth/signin", { identifier: "yoq@example.uz", password: PASSWORD }))).json.error.code).toBe("wrong_password");
    const view = await send(me, req("/api/v1/me", undefined, { token: again.json.tokens.accessToken, method: "GET" }));
    expect(view.json.user).toMatchObject({ phone: null, email: EMAIL });
  });

  it("bir xil tasdiqlangan email — bitta hisob (Apple Google hisobiga bog'lanadi); tasdiqlanmagani bog'lanmaydi", async () => {
    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g2", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: await withPassword(first.json.registrationTicket), firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    const userId = created.json.user.id as string;

    const unverified = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a-unverified", EMAIL, false) }));
    expect(unverified.json.next).toBe("register");
    expect(unverified.json.profile.email).toBeNull();

    const linked = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a2", EMAIL), firstName: "Ali" }));
    expect(linked.json).toMatchObject({ next: "password" });
    expect((await send(login, req("/api/v1/auth/login", { ticket: linked.json.ticket, password: PASSWORD }))).json.user.id).toBe(userId);
    expect(await db.authIdentity.count({ where: { userId } })).toBe(2);
    expect(await db.auditLog.count({ where: { actorId: userId, action: "user.identity.link" } })).toBe(1);
  });

  it("Apple: ism mijozdan (tokenda yo'q); biznes ro'yxati — contactPhone yo'q", async () => {
    const first = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a3"), intent: "business", firstName: "Bekzod", lastName: "Karimov" }));
    expect(first.json).toMatchObject({ next: "register", role: "business", profile: { firstName: "Bekzod", lastName: "Karimov", email: null } });
    // Talaba ticketi biznesga o'tmaydi
    const info = { name: "Itest Kofe", address: "Toshkent, Chilonzor 9", tin: TIN, phone: "+998901112233", telegram: "@itest_kofe" };
    const created = await send(businessRegister, req("/api/v1/business/register", { registrationTicket: await withPassword(first.json.registrationTicket), ...info }));
    expect(created.status).toBe(201);
    expect(created.json.user).toMatchObject({ role: "BUSINESS_OWNER", phone: null, email: null, business: { name: "Itest Kofe", submitted: false } });
    expect(await db.business.findFirst({ where: { tin: TIN }, select: { contactPhone: true } })).toEqual({ contactPhone: null });
  });

  it("xatolar: client ID yo'q — 503, buzilgan token — 401, bloklangan hisob — kirmaydi", async () => {
    expect(await send(apple, req("/api/v1/auth/apple", { idToken: "unconfigured-token-0000000" }))).toMatchObject({ status: 503, json: { error: { code: "social_unavailable" } } });
    expect(await send(google, req("/api/v1/auth/google", { idToken: "bad-token-000000000000000" }))).toMatchObject({ status: 401, json: { error: { code: "social_invalid" } } });

    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g4", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: await withPassword(first.json.registrationTicket), firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    await db.user.update({ where: { id: created.json.user.id }, data: { status: "BLOCKED" } });
    expect((await send(google, req("/api/v1/auth/google", { idToken: idToken("g4", EMAIL) }))).json.error.code).toBe("account_blocked");
  });

  it("parolsiz hisobni o'chirish — o'sha provayder tokeni bilan; keyin shu Google bilan yangi hisob ochiladi", async () => {
    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g5", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: await withPassword(first.json.registrationTicket), firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    const token = created.json.tokens.accessToken as string;
    // Eski (parolsiz) Google hisobi: o'chirish provayder tokeni bilan
    await db.user.update({ where: { id: created.json.user.id }, data: { passwordHash: null } });

    expect((await send(deleteMe, req("/api/v1/me", {}, { token, method: "DELETE" }))).json.error.code).toBe("password_required");
    expect((await send(deleteMe, req("/api/v1/me", { provider: "GOOGLE", idToken: idToken("begona", EMAIL) }, { token, method: "DELETE" }))).json.error.code).toBe("social_mismatch");
    expect(await send(deleteMe, req("/api/v1/me", { provider: "GOOGLE", idToken: idToken("g5", EMAIL) }, { token, method: "DELETE" }))).toMatchObject({ status: 200, json: { ok: true } });

    const gone = await db.user.findUniqueOrThrow({ where: { id: created.json.user.id }, select: { status: true, email: true, _count: { select: { identities: true } } } });
    expect(gone).toEqual({ status: "DELETED", email: null, _count: { identities: 0 } });
    expect((await send(google, req("/api/v1/auth/google", { idToken: idToken("g5", EMAIL) }))).json.next).toBe("register");
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
    expect(first.json).toMatchObject({ next: "register", role: "student", profile: { firstName: "Olim", lastName: "Webov" } });

    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: await withPassword(first.json.registrationTicket), firstName: "Olim", lastName: "Webov", universityId, course: "C1" }));
    const token = created.json.tokens.accessToken as string;
    await db.user.update({ where: { id: created.json.user.id }, data: { passwordHash: null } });
    const again = await appleCallback(form({ state, id_token: idToken("a-web", "") }), ctx);
    const ticket2 = new URL(again.headers.get("location")!.replace(/^intent:/, "https:").replace(/#Intent.*$/, "")).searchParams.get("ticket")!;
    expect(await send(deleteMe, req("/api/v1/me", { provider: "APPLE", ticket: ticket2, verifier }, { token, method: "DELETE" }))).toMatchObject({ status: 200, json: { ok: true } });
  });
});

