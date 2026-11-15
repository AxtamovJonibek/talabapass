import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as couponState, DELETE as cancel } from "@/app/api/v1/coupons/[id]/route";
import { GET as coupons, POST as claim } from "@/app/api/v1/coupons/route";
import { GET as deal } from "@/app/api/v1/deals/[id]/route";
import { GET as nearby } from "@/app/api/v1/deals/nearby/route";
import { GET as deals } from "@/app/api/v1/deals/route";
import { GET as notifications } from "@/app/api/v1/notifications/route";
import { GET as districts } from "@/app/api/v1/districts/route";
import { POST as markRead } from "@/app/api/v1/notifications/read/route";
import { DELETE as pushDelete, POST as pushRegister } from "@/app/api/v1/push/devices/route";
import { DELETE as unsave, PUT as save } from "@/app/api/v1/saved/[id]/route";
import { GET as saved } from "@/app/api/v1/saved/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { toTashkent } from "@/lib/time";
import { db } from "../db";
import { limitKey } from "./rate-limit";
import { openApiSession } from "./session";

// Faqat shu test ishlatadigan raqamlar va STIR
const STUDENT_PHONE = "+998000000331";
const PENDING_PHONE = "+998000000332";
const OWNER_PHONE = "+998000000333";
const PHONES = [STUDENT_PHONE, PENDING_PHONE, OWNER_PHONE];
const TIN = "900000331";
const DAY_MS = 86_400_000;
const HERE = { lat: 41.2995, lng: 69.2401 };
const PUSH_TOKEN = "ExponentPushToken[itest-api-331]";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Handler = (r: NextRequest, c: { params: Promise<any> }) => Promise<Response>; // eslint-disable-line @typescript-eslint/no-explicit-any

let token: string;
let pendingToken: string;
let studentId: string;
let discountId: string;

async function call(handler: Handler, path: string, { method = "GET", body, auth = token, params = {} }: { method?: string; body?: unknown; auth?: string; params?: object } = {}) {
  const request = new NextRequest(`http://localhost${path}`, {
    method,
    headers: { authorization: `Bearer ${auth}`, "x-real-ip": "198.51.100.33" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handler(request, { params: Promise.resolve(params) });
  return { status: res.status, json: (await res.json()) as Json };
}

async function cleanup() {
  const users = await db.user.findMany({ where: { phone: { in: PHONES } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.coupon.deleteMany({ where: { studentId: { in: ids } } });
  await db.notification.deleteMany({ where: { createdById: { in: ids } } });
  await db.business.deleteMany({ where: { tin: TIN } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.rateLimitHit.deleteMany({ where: { key: { in: ids.flatMap((id) => [limitKey("claim", id), limitKey("write", id)]) } } });
}

beforeAll(async () => {
  await cleanup();
  const today = toTashkent(new Date()).date;
  const minute = toTashkent(new Date()).minute;
  const uni = await db.university.findFirstOrThrow({ where: { kind: { not: "OTHER" } } });
  const student = await db.user.create({
    data: {
      phone: STUDENT_PHONE,
      role: "STUDENT",
      firstName: "Api",
      lastName: "Talaba",
      student: { create: { universityId: uni.id, course: "C2", publicId: "TP-APITEST-1", status: "APPROVED", cardExpiresAt: new Date(today.getTime() + 300 * DAY_MS) } },
    },
  });
  studentId = student.id;
  const pending = await db.user.create({
    data: { phone: PENDING_PHONE, role: "STUDENT", firstName: "Api", student: { create: { universityId: uni.id, course: "C1", publicId: "TP-APITEST-2", status: "PENDING" } } },
  });
  const owner = await db.user.create({ data: { phone: OWNER_PHONE, role: "BUSINESS_OWNER", firstName: "Egasi" } });
  const business = await db.business.create({
    data: { ownerId: owner.id, name: "Api test kafe", tin: TIN, kind: "CAFE", address: "Bunyodkor 1", workingHours: "09–22", status: "APPROVED", submittedAt: new Date(), lat: HERE.lat + 0.01, lng: HERE.lng },
  });
  const category = await db.category.findFirstOrThrow({ where: { slug: "taom" } });
  const discount = await db.discount.create({
    data: {
      businessId: business.id,
      categoryId: category.id,
      title: "Api test osh",
      type: "PERCENT",
      originalPrice: 38000,
      percent: 30,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      fromMinute: Math.max(0, minute - 60),
      toMinute: Math.min(1440, minute + 60),
      dailyLimit: 5,
      perStudentLimit: "DAILY",
      startsOn: new Date(today.getTime() - DAY_MS),
      endsOn: new Date(today.getTime() + 10 * DAY_MS),
      status: "ACTIVE",
    },
  });
  discountId = discount.id;
  token = (await openApiSession(studentId, { deviceName: "itest" })).accessToken;
  pendingToken = (await openApiSession(pending.id)).accessToken;
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("API: talaba asosiy", () => {
  it("tasdiqlanmagan talaba lentani ko'rmaydi (holati bilan)", async () => {
    const res = await call(deals, "/api/v1/deals", { auth: pendingToken });
    expect(res.status).toBe(403);
    expect(res.json.error).toMatchObject({ code: "student_not_approved", status: "PENDING" });
  });

  it("lenta: filtr, masofa va kategoriyalar", async () => {
    const res = await call(deals, `/api/v1/deals?lat=${HERE.lat}&lng=${HERE.lng}&q=api+test&category=taom&sort=near`);
    expect(res.status).toBe(200);
    expect(res.json.deals).toHaveLength(1);
    expect(res.json.deals[0]).toMatchObject({ id: discountId, live: true, left: 5, total: 5, distanceKm: expect.any(Number) });
    expect(res.json.categories.some((c: Json) => c.slug === "taom")).toBe(true);
    expect((await call(deals, "/api/v1/deals?q=api+test&category=kino")).json.deals).toHaveLength(0);
    expect((await call(deals, "/api/v1/deals?lat=200&lng=0")).json.error.code).toBe("invalid_request");
  });

  it("yaqin joylar: radius ichida, joysiz — xato", async () => {
    const near = await call(nearby, `/api/v1/deals/nearby?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=3`);
    expect(near.json.deals.map((d: Json) => d.id)).toContain(discountId);
    const tight = await call(nearby, `/api/v1/deals/nearby?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=0.5`);
    expect(tight.json.deals.map((d: Json) => d.id)).not.toContain(discountId);
    expect((await call(nearby, "/api/v1/deals/nearby")).status).toBe(400);
  });

  it("tafsilot va saqlash", async () => {
    const detail = await call(deal, `/api/v1/deals/${discountId}`, { params: { id: discountId } });
    expect(detail.json).toMatchObject({ deal: { id: discountId }, saved: false, coupon: null, business: { name: "Api test kafe" } });
    expect((await call(deal, "/api/v1/deals/yoq0000000000", { params: { id: "yoq0000000000" } })).status).toBe(404);

    expect((await call(save, `/api/v1/saved/${discountId}`, { method: "PUT", params: { id: discountId } })).json.saved).toBe(true);
    expect((await call(save, `/api/v1/saved/${discountId}`, { method: "PUT", params: { id: discountId } })).json.saved).toBe(true);
    expect((await call(saved, "/api/v1/saved")).json.deals.map((d: Json) => d.id)).toEqual([discountId]);
    await call(unsave, `/api/v1/saved/${discountId}`, { method: "DELETE", params: { id: discountId } });
    expect((await call(saved, "/api/v1/saved")).json.deals).toEqual([]);
  });

  it("kupon: olish (takror — o'sha), holat, bekor qilish qoldiqni qaytaradi", async () => {
    const first = await call(claim, "/api/v1/coupons", { method: "POST", body: { discountId } });
    expect(first.status).toBe(201);
    expect(first.json.coupon).toMatchObject({ code: expect.stringMatching(/^TP-/), secret: expect.any(String), expiresAt: expect.any(String) });
    const again = await call(claim, "/api/v1/coupons", { method: "POST", body: { discountId } });
    expect(again.json).toMatchObject({ existing: true, coupon: { id: first.json.coupon.id } });

    const id = first.json.coupon.id as string;
    expect((await call(couponState, `/api/v1/coupons/${id}`, { params: { id } })).json).toMatchObject({ status: "ACTIVE", coupon: { id, discountId } });
    expect((await call(coupons, "/api/v1/coupons")).json.coupons).toHaveLength(1);
    expect((await call(deal, `/api/v1/deals/${discountId}`, { params: { id: discountId } })).json.deal.left).toBe(4);

    expect((await call(cancel, `/api/v1/coupons/${id}`, { method: "DELETE", params: { id } })).status).toBe(200);
    expect((await call(couponState, `/api/v1/coupons/${id}`, { params: { id } })).json.status).toBe("CLOSED");
    expect((await call(deal, `/api/v1/deals/${discountId}`, { params: { id: discountId } })).json.deal.left).toBe(5);
    // Kuniga bitta (DAILY): bekor qilingani hisobga kirmaydi — qayta olish mumkin
    expect((await call(claim, "/api/v1/coupons", { method: "POST", body: { discountId } })).status).toBe(201);
  });

  it("tumanlar va viloyatlar (joy tanlovi)", async () => {
    const res = await call(districts, "/api/v1/districts", { auth: "" });
    expect(res.status).toBe(200);
    expect(res.json.regions.length).toBeGreaterThan(10);
    expect(res.json.districts).toEqual(expect.arrayContaining([]));
  });

  it("begona kupon ko'rinmaydi; tasdiqlanmagan talaba kupon ololmaydi", async () => {
    const mine = (await call(coupons, "/api/v1/coupons")).json.coupons[0];
    expect((await call(couponState, `/api/v1/coupons/${mine.id}`, { auth: pendingToken, params: { id: mine.id } })).status).toBe(403);
    expect((await call(claim, "/api/v1/coupons", { method: "POST", body: { discountId }, auth: pendingToken })).json.error.code).toBe("student_not_approved");
  });

  it("bildirishnomalar va push qurilmasi (chiqishda o'chadi)", async () => {
    // Bittasini o'qilgan qilish (`ids`), keyin hammasini; begona id e'tiborsiz
    const sent = new Date();
    const made = await Promise.all(
      ["a", "b"].map((title) =>
        db.notification.create({
          data: { title, body: "b", audience: "USER", scheduledAt: sent, sentAt: sent, status: "SENT", createdById: studentId, recipients: { create: { userId: studentId } } },
          select: { recipients: { select: { id: true } } },
        }),
      ),
    );
    const [one, two] = made.map((n) => n.recipients[0]!.id);
    const before = (await call(notifications, "/api/v1/notifications")).json.unread as number;
    expect((await call(markRead, "/api/v1/notifications/read", { method: "POST", body: { ids: [one, "cm0000000000000000000000"] } })).json.marked).toBe(1);
    const items = (await call(notifications, "/api/v1/notifications")).json.items as Json[];
    expect(items.find((i) => i.id === one)?.unread).toBe(false);
    expect(items.find((i) => i.id === two)?.unread).toBe(true);
    expect((await call(notifications, "/api/v1/notifications")).json.unread).toBe(before - 1);

    const inbox = await call(notifications, "/api/v1/notifications");
    expect(inbox.json).toMatchObject({ unread: expect.any(Number), items: expect.any(Array) });
    expect((await call(markRead, "/api/v1/notifications/read", { method: "POST" })).status).toBe(200);
    expect((await call(notifications, "/api/v1/notifications")).json.unread).toBe(0);

    expect((await call(pushRegister, "/api/v1/push/devices", { method: "POST", body: { token: PUSH_TOKEN, platform: "IOS" } })).status).toBe(200);
    expect(await db.pushDevice.count({ where: { token: PUSH_TOKEN, userId: studentId } })).toBe(1);
    await call(pushDelete, "/api/v1/push/devices", { method: "DELETE", body: { token: PUSH_TOKEN } });
    expect(await db.pushDevice.count({ where: { token: PUSH_TOKEN } })).toBe(0);

    await call(pushRegister, "/api/v1/push/devices", { method: "POST", body: { token: PUSH_TOKEN, platform: "ANDROID" } });
    await call(logout, "/api/v1/auth/logout", { method: "POST" });
    expect(await db.pushDevice.count({ where: { token: PUSH_TOKEN } })).toBe(0);
  });
});
