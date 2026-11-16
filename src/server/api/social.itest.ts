import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as apple } from "@/app/api/v1/auth/apple/route";
import { POST as google } from "@/app/api/v1/auth/google/route";
import { POST as businessRegister } from "@/app/api/v1/business/register/route";
import { DELETE as deleteMe, GET as me } from "@/app/api/v1/me/route";
import { POST as studentRegister } from "@/app/api/v1/student/register/route";
import { db } from "../db";
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

const idToken = (sub: string, email = "", verified = true) => `${P}${sub}|${email}|${verified ? "1" : "0"}`.padEnd(24, ".");

async function cleanup() {
  const identities = await db.authIdentity.findMany({ where: { subject: { startsWith: P } }, select: { userId: true } });
  const users = await db.user.findMany({ where: { OR: [{ email: { startsWith: "itest.social" } }, { id: { in: identities.map((i) => i.userId) } }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.business.deleteMany({ where: { OR: [{ ownerId: { in: ids } }, { tin: TIN }] } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.rateLimitHit.deleteMany({ where: { key: { in: [limitKey("verify", IP), limitKey("register", IP), ...ids.map((id) => limitKey("password", id))] } } });
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
    const body = { registrationTicket: first.json.registrationTicket, firstName: "Gulnoza", lastName: "Testova", universityId, course: "C1" };
    const created = await send(studentRegister, req("/api/v1/student/register", body));
    expect(created.status).toBe(201);
    expect(created.json.user).toMatchObject({ role: "STUDENT", phone: null, email: EMAIL, hasPassword: false, student: { status: "DRAFT" } });

    // Bir ticket — bitta hisob
    expect((await send(studentRegister, req("/api/v1/student/register", body))).json.error.code).toBe("step_expired");

    const again = await send(google, req("/api/v1/auth/google", { idToken: idToken("g1", EMAIL), intent: "business" }));
    expect(again.json).toMatchObject({ next: "signedIn", user: { id: created.json.user.id, role: "STUDENT" } });
    const view = await send(me, req("/api/v1/me", undefined, { token: again.json.tokens.accessToken, method: "GET" }));
    expect(view.json.user).toMatchObject({ phone: null, email: EMAIL });
  });

  it("bir xil tasdiqlangan email — bitta hisob (Apple Google hisobiga bog'lanadi); tasdiqlanmagani bog'lanmaydi", async () => {
    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g2", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: first.json.registrationTicket, firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    const userId = created.json.user.id as string;

    const unverified = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a-unverified", EMAIL, false) }));
    expect(unverified.json.next).toBe("register");
    expect(unverified.json.profile.email).toBeNull();

    const linked = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a2", EMAIL), firstName: "Ali" }));
    expect(linked.json).toMatchObject({ next: "signedIn", user: { id: userId } });
    expect(await db.authIdentity.count({ where: { userId } })).toBe(2);
    expect(await db.auditLog.count({ where: { actorId: userId, action: "user.identity.link" } })).toBe(1);
  });

  it("Apple: ism mijozdan (tokenda yo'q); biznes ro'yxati — contactPhone yo'q", async () => {
    const first = await send(apple, req("/api/v1/auth/apple", { idToken: idToken("a3"), intent: "business", firstName: "Bekzod", lastName: "Karimov" }));
    expect(first.json).toMatchObject({ next: "register", role: "business", profile: { firstName: "Bekzod", lastName: "Karimov", email: null } });
    // Talaba ticketi biznesga o'tmaydi
    const info = { name: "Itest Kofe", kind: "CAFE", address: "Toshkent, Chilonzor 9", workingHours: "09:00 – 22:00", tin: TIN, contactName: "Bekzod Karimov" };
    const created = await send(businessRegister, req("/api/v1/business/register", { registrationTicket: first.json.registrationTicket, ...info }));
    expect(created.status).toBe(201);
    expect(created.json.user).toMatchObject({ role: "BUSINESS_OWNER", phone: null, email: null, business: { name: "Itest Kofe", submitted: false } });
    expect(await db.business.findFirst({ where: { tin: TIN }, select: { contactPhone: true } })).toEqual({ contactPhone: null });
  });

  it("xatolar: client ID yo'q — 503, buzilgan token — 401, bloklangan hisob — kirmaydi", async () => {
    expect(await send(apple, req("/api/v1/auth/apple", { idToken: "unconfigured-token-0000000" }))).toMatchObject({ status: 503, json: { error: { code: "social_unavailable" } } });
    expect(await send(google, req("/api/v1/auth/google", { idToken: "bad-token-000000000000000" }))).toMatchObject({ status: 401, json: { error: { code: "social_invalid" } } });

    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g4", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: first.json.registrationTicket, firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    await db.user.update({ where: { id: created.json.user.id }, data: { status: "BLOCKED" } });
    expect((await send(google, req("/api/v1/auth/google", { idToken: idToken("g4", EMAIL) }))).json.error.code).toBe("account_blocked");
  });

  it("parolsiz hisobni o'chirish — o'sha provayder tokeni bilan; keyin shu Google bilan yangi hisob ochiladi", async () => {
    const first = await send(google, req("/api/v1/auth/google", { idToken: idToken("g5", EMAIL) }));
    const { id: universityId } = await university();
    const created = await send(studentRegister, req("/api/v1/student/register", { registrationTicket: first.json.registrationTicket, firstName: "Ali", lastName: "Valiyev", universityId, course: "C2" }));
    const token = created.json.tokens.accessToken as string;

    expect((await send(deleteMe, req("/api/v1/me", {}, { token, method: "DELETE" }))).json.error.code).toBe("password_required");
    expect((await send(deleteMe, req("/api/v1/me", { provider: "GOOGLE", idToken: idToken("begona", EMAIL) }, { token, method: "DELETE" }))).json.error.code).toBe("social_mismatch");
    expect(await send(deleteMe, req("/api/v1/me", { provider: "GOOGLE", idToken: idToken("g5", EMAIL) }, { token, method: "DELETE" }))).toMatchObject({ status: 200, json: { ok: true } });

    const gone = await db.user.findUniqueOrThrow({ where: { id: created.json.user.id }, select: { status: true, email: true, _count: { select: { identities: true } } } });
    expect(gone).toEqual({ status: "DELETED", email: null, _count: { identities: 0 } });
    expect((await send(google, req("/api/v1/auth/google", { idToken: idToken("g5", EMAIL) }))).json.next).toBe("register");
  });
});

