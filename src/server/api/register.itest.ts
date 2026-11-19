import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as password } from "@/app/api/v1/auth/password/route";
import { POST as verify } from "@/app/api/v1/auth/verify/route";
import { GET as application } from "@/app/api/v1/business/application/route";
import { POST as documents } from "@/app/api/v1/business/documents/route";
import { POST as businessRegister } from "@/app/api/v1/business/register/route";
import { POST as submit } from "@/app/api/v1/business/submit/route";
import { POST as card } from "@/app/api/v1/student/card/route";
import { POST as studentRegister } from "@/app/api/v1/student/register/route";
import { GET as status } from "@/app/api/v1/student/status/route";
import { GET as universities } from "@/app/api/v1/universities/route";
import { hashOtp } from "../auth/otp-rules";
import { db } from "../db";
import { authSecret } from "../env";
import { limitKey } from "./rate-limit";

// Faqat shu test ishlatadigan raqamlar, IP va STIR
const STUDENT_PHONE = "+998000000321";
const OWNER_PHONE = "+998000000322";
const PHONES = [STUDENT_PHONE, OWNER_PHONE];
const IP = "198.51.100.32";
const TIN = "900000321";
const PASSWORD = "parol1234";
const CODE = "482913";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ctx = { params: Promise.resolve({}) };
let PNG: Uint8Array;
let dir: string;

function jsonReq(path: string, body?: unknown, token?: string, method = "POST") {
  const headers: Record<string, string> = { "x-real-ip": IP };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

function fileReq(path: string, token: string, bytes: Uint8Array, name = "foto.png") {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: "image/png" }), name);
  return new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "x-real-ip": IP, authorization: `Bearer ${token}` }, body: form });
}

async function send(handler: (r: NextRequest, c: typeof ctx) => Promise<Response>, request: NextRequest) {
  const res = await handler(request, ctx);
  return { status: res.status, json: (await res.json()) as Json };
}

/** SMS kod → parol → ro'yxat tokeni. */
async function registrationTicket(phone: string, intent: "student" | "business") {
  await db.otpCode.create({ data: { phone, codeHash: hashOtp(phone, CODE, authSecret()), expiresAt: new Date(Date.now() + 5 * 60_000) } });
  const v = await send(verify, jsonReq("/api/v1/auth/verify", { phone, code: CODE, intent }));
  const set = await send(password, jsonReq("/api/v1/auth/password", { ticket: v.json.ticket, password: PASSWORD, confirm: PASSWORD }));
  expect(set.json.next).toBe("register");
  return set.json.registrationTicket as string;
}

async function cleanup() {
  const users = await db.user.findMany({ where: { phone: { in: PHONES } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.business.deleteMany({ where: { OR: [{ ownerId: { in: ids } }, { tin: TIN }] } });
  await db.universityRequest.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.otpCode.deleteMany({ where: { phone: { in: PHONES } } });
  await db.rateLimitHit.deleteMany({
    where: { key: { in: [...(["verify", "password", "register"] as const).map((b) => limitKey(b, IP)), ...ids.map((id) => limitKey("upload", id))] } },
  });
}

beforeAll(async () => {
  PNG = new Uint8Array(await sharp({ create: { width: 240, height: 160, channels: 3, background: "#acf" } }).png().toBuffer());
  // Testlar o'z vaqtinchalik omboriga yozadi — loyihadagi .data ga tegmaydi.
  dir = await mkdtemp(join(tmpdir(), "talabapass-api-itest-"));
  process.env.STORAGE_DRIVER = "local";
  process.env.STORAGE_LOCAL_DIR = dir;
});
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
  await rm(dir, { recursive: true, force: true });
});

describe("API: talaba ro'yxati", () => {
  it("OTM ro'yxati → ro'yxat → guvohnoma → tekshiruv holati", async () => {
    const list = await send(universities, jsonReq("/api/v1/universities?q=", undefined, undefined, "GET"));
    expect(list.json.otherId).toBe("other");
    const university = list.json.universities[0];
    expect(university).toMatchObject({ id: expect.any(String), name: expect.any(String) });

    const ticket = await registrationTicket(STUDENT_PHONE, "student");
    const bad = await send(studentRegister, jsonReq("/api/v1/student/register", { registrationTicket: ticket, firstName: "", lastName: "Testov", universityId: "yoq", course: "C9" }));
    expect(bad.json.error).toMatchObject({ code: "invalid_request", fields: expect.arrayContaining(["firstName", "course"]) });

    const created = await send(
      studentRegister,
      jsonReq("/api/v1/student/register", { registrationTicket: ticket, firstName: "Aziz", lastName: "Testov", universityId: university.id, course: "C2" }),
    );
    expect(created.status).toBe(201);
    expect(created.json.user).toMatchObject({ role: "STUDENT", hasPassword: true, student: { status: "DRAFT", course: "C2" } });
    const token = created.json.tokens.accessToken as string;

    // Bir ticket — bitta hisob
    const twice = await send(studentRegister, jsonReq("/api/v1/student/register", { registrationTicket: ticket, firstName: "Aziz", lastName: "Testov", universityId: university.id, course: "C2" }));
    expect(twice.json.error.code).toBe("step_expired");

    const notFile = await send(card, fileReq("/api/v1/student/card", token, new TextEncoder().encode("rasm emas")));
    expect(notFile.json.error.code).toBe("file_bad_type");

    const uploaded = await send(card, fileReq("/api/v1/student/card", token, PNG, "guvohnoma.png"));
    expect(uploaded.status).toBe(201);
    const state = await send(status, jsonReq("/api/v1/student/status", undefined, token, "GET"));
    expect(state.json).toMatchObject({ status: "PENDING", verification: { status: "PENDING", fileName: "guvohnoma.png", queuePosition: expect.any(Number) } });
  });

  it("biznes ro'yxati tokeni talaba ro'yxatida ishlamaydi", async () => {
    const ticket = await registrationTicket(STUDENT_PHONE, "business");
    const res = await send(studentRegister, jsonReq("/api/v1/student/register", { registrationTicket: ticket, firstName: "Aziz", lastName: "Testov", universityId: "other", universityOther: "Test instituti", course: "C1" }));
    expect(res.json.error.code).toBe("step_expired");
  });
});

describe("API: biznes ro'yxati (bitta ekran)", () => {
  it("hisob → ixtiyoriy rasm → yuborish", async () => {
    const ticket = await registrationTicket(OWNER_PHONE, "business");
    const bad = await send(businessRegister, jsonReq("/api/v1/business/register", { registrationTicket: ticket, name: "A", address: "Toshkent, Chilonzor 1", tin: "123", phone: "x", telegram: "" }));
    expect(bad.json.error.code).toBe("invalid_request");
    expect(bad.json.error.fields).toEqual(["name", "tin", "phone", "telegram"]);

    const created = await send(
      businessRegister,
      jsonReq("/api/v1/business/register", { registrationTicket: ticket, name: "Test kafe", address: "Toshkent, Chilonzor 1", tin: TIN, phone: "+998901112233", telegram: "@test_kafe" }),
    );
    expect(created.status).toBe(201);
    expect(created.json.user).toMatchObject({ role: "BUSINESS_OWNER", business: { name: "Test kafe", status: "PENDING", submitted: false } });
    const token = created.json.tokens.accessToken as string;

    expect((await send(documents, fileReq("/api/v1/business/documents?kind=logo", token, PNG))).status).toBe(201);
    expect((await send(submit, jsonReq("/api/v1/business/submit", {}, token))).status).toBe(200);

    const app = await send(application, jsonReq("/api/v1/business/application", undefined, token, "GET"));
    expect(app.json.application).toMatchObject({ status: "PENDING", editable: false, submittedAt: expect.any(String), phone: "+998901112233", telegram: "test_kafe", hasLogo: true });
    // Tekshiruvdagi arizaga fayl qo'shilmaydi
    expect((await send(documents, fileReq("/api/v1/business/documents?kind=logo", token, PNG))).json.error.code).toBe("upload_not_allowed");
  });

  it("talaba tokeni bilan biznes endpoint'i — forbidden", async () => {
    const ticket = await registrationTicket(STUDENT_PHONE, "student");
    const list = await send(universities, jsonReq("/api/v1/universities", undefined, undefined, "GET"));
    const created = await send(
      studentRegister,
      jsonReq("/api/v1/student/register", { registrationTicket: ticket, firstName: "Aziz", lastName: "Testov", universityId: list.json.universities[0].id, course: "C1" }),
    );
    const res = await send(application, jsonReq("/api/v1/business/application", undefined, created.json.tokens.accessToken, "GET"));
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("forbidden");
  });
});
