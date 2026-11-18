import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as passwordRoute } from "@/app/api/v1/auth/password/route";
import { POST as verifyRoute } from "@/app/api/v1/auth/verify/route";
import { GET as cashiersRoute, POST as inviteRoute } from "@/app/api/v1/business/cashiers/route";
import { DELETE as removeCashierRoute } from "@/app/api/v1/business/cashiers/[id]/route";
import { DELETE as removeImageRoute } from "@/app/api/v1/business/discount-images/[id]/route";
import { GET as discountsRoute, POST as createDiscountRoute } from "@/app/api/v1/business/discounts/route";
import { GET as discountRoute, PATCH as patchDiscountRoute } from "@/app/api/v1/business/discounts/[id]/route";
import { POST as activeRoute } from "@/app/api/v1/business/discounts/[id]/active/route";
import { POST as imageRoute } from "@/app/api/v1/business/discounts/[id]/images/route";
import { DELETE as revokeInviteRoute } from "@/app/api/v1/business/invites/[id]/route";
import { GET as ordersRoute } from "@/app/api/v1/business/orders/route";
import { POST as orderRoute } from "@/app/api/v1/business/orders/[id]/route";
import { GET as profileRoute, PATCH as editProfileRoute } from "@/app/api/v1/business/profile/route";
import { GET as salesRoute } from "@/app/api/v1/business/sales/route";
import { POST as confirmRoute } from "@/app/api/v1/business/scan/confirm/route";
import { GET as scanSummaryRoute, POST as scanRoute } from "@/app/api/v1/business/scan/route";
import { GET as statsRoute } from "@/app/api/v1/business/stats/route";
import { GET as preorderRoute, PUT as savePreorderRoute } from "@/app/api/v1/business/preorder/route";
import { POST as pauseRoute } from "@/app/api/v1/business/preorder/pause/route";
import { POST as previewRoute } from "@/app/api/v1/business/preorder/preview/route";
import { PUT as bookingRoute } from "@/app/api/v1/business/discounts/[id]/booking/route";
import { DEFAULT_DISCOUNT_BOOKING, DEFAULT_SETTINGS } from "@/lib/preorder";
import { POST as cashierRegisterRoute } from "@/app/api/v1/cashier/register/route";
import { GET as dealRoute } from "@/app/api/v1/deals/[id]/route";
import { GET as fileRoute } from "@/app/api/v1/files/[kind]/[id]/route";
import { GET as meRoute } from "@/app/api/v1/me/route";
import { GET as receiptRoute } from "@/app/api/v1/receipts/[id]/route";
import { fromBase64Url, qrToken, totpCode, windowAt } from "@/lib/totp";
import { toTashkent } from "@/lib/time";
import { hashOtp } from "../auth/otp-rules";
import { claimCoupon, studentCoupon } from "../coupons/coupons";
import { db } from "../db";
import { authSecret } from "../env";
import { notifyRedeemed } from "../notifications/direct";
import { checkExpoReceipts, expoFromWebPayload, sendExpoPush } from "../notifications/expo-push";
import { limitKey } from "./rate-limit";
import { hashPassword } from "../auth/password";
import { openApiSession } from "./session";

// Faqat shu test ishlatadigan raqamlar va STIR
const OWNER_PHONE = "+998000000341";
const CASHIER_PHONE = "+998000000342";
const CASHIER2_PHONE = "+998000000343";
const STUDENT_PHONE = "+998000000344";
const OTHER_OWNER_PHONE = "+998000000345";
const OTHER_CASHIER_PHONE = "+998000000346";
const PENDING_OWNER_PHONE = "+998000000347";
const NEW_CASHIER_PHONE = "+998000000348";
const PHONES = [OWNER_PHONE, CASHIER_PHONE, CASHIER2_PHONE, STUDENT_PHONE, OTHER_OWNER_PHONE, OTHER_CASHIER_PHONE, PENDING_OWNER_PHONE, NEW_CASHIER_PHONE];
const TINS = ["900000341", "900000345", "900000347"];
const DAY_MS = 86_400_000;
const CODE = "482913";
const TICKET = "itest-biz-ticket-0001";
// 1×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Handler = (r: NextRequest, c: { params: Promise<any> }) => Promise<Response>; // eslint-disable-line @typescript-eslint/no-explicit-any

const t: Record<string, string> = {};
const ids: Record<string, string> = {};

async function call(handler: Handler, path: string, { method = "GET", body, auth, params = {}, form }: { method?: string; body?: unknown; auth?: string; params?: object; form?: FormData } = {}) {
  const headers: Record<string, string> = { "x-real-ip": "198.51.100.34", "user-agent": "vitest" };
  if (auth) headers.authorization = `Bearer ${auth}`;
  const request = form
    ? new NextRequest(`http://localhost${path}`, { method, headers, body: form })
    : new NextRequest(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await handler(request, { params: Promise.resolve(params) });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, type, json: (type.includes("json") ? await res.json() : {}) as Json };
}

/** Talaba kupon oladi va kassir ekranidagi QR matni (saytdagi `src/lib/totp` bilan) */
async function freshCoupon() {
  const claimed = await claimCoupon(ids.student!, ids.discount!);
  if (!claimed.ok) throw new Error(`kupon olinmadi: ${claimed.error}`);
  const coupon = (await studentCoupon(ids.student!, claimed.couponId))!;
  const secret = fromBase64Url(coupon.secret);
  const window = windowAt(Date.now());
  return { coupon, qr: await qrToken(coupon.code, secret, window), totp: await totpCode(secret, window) };
}

async function cleanup() {
  const users = await db.user.findMany({ where: { phone: { in: PHONES } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const businesses = await db.business.findMany({ where: { tin: { in: TINS } }, select: { id: true } });
  const businessIds = businesses.map((b) => b.id);
  await db.redemption.deleteMany({ where: { businessId: { in: businessIds } } });
  await db.scanAttempt.deleteMany({ where: { businessId: { in: businessIds } } });
  await db.coupon.deleteMany({ where: { studentId: { in: userIds } } });
  await db.discountImage.deleteMany({ where: { discount: { businessId: { in: businessIds } } } });
  await db.preorderSettings.deleteMany({ where: { businessId: { in: businessIds } } });
  await db.business.deleteMany({ where: { id: { in: businessIds } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  // Sotuv xabarlari (createdById — kassir/egasi)
  await db.notification.deleteMany({ where: { createdById: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.otpCode.deleteMany({ where: { phone: { in: PHONES } } });
  await db.rateLimitHit.deleteMany({ where: { key: { in: userIds.flatMap((id) => (["scan", "write", "upload"] as const).map((b) => limitKey(b, id))) } } });
}

beforeAll(async () => {
  await cleanup();
  const now = toTashkent(new Date());
  const uni = await db.university.findFirstOrThrow({ where: { kind: { not: "OTHER" } } });
  const student = await db.user.create({
    data: {
      phone: STUDENT_PHONE,
      role: "STUDENT",
      firstName: "Biz",
      lastName: "Talaba",
      student: { create: { universityId: uni.id, course: "C3", publicId: "TP-APIBIZ-1", status: "APPROVED", cardExpiresAt: new Date(now.date.getTime() + 300 * DAY_MS) } },
    },
  });
  const owner = await db.user.create({ data: { phone: OWNER_PHONE, role: "BUSINESS_OWNER", firstName: "Egasi" } });
  const business = await db.business.create({
    data: { ownerId: owner.id, name: "Biz test kafe", tin: TINS[0]!, kind: "CAFE", address: "Bunyodkor 1", workingHours: "09–22", status: "APPROVED", submittedAt: new Date(), members: { create: { userId: owner.id, role: "OWNER" } } },
  });
  const cashier = await db.user.create({ data: { phone: CASHIER_PHONE, role: "CASHIER", firstName: "Kassir", lastName: "Bir", memberships: { create: { businessId: business.id, role: "CASHIER" } } } });
  const cashier2 = await db.user.create({ data: { phone: CASHIER2_PHONE, role: "CASHIER", firstName: "Kassir", lastName: "Ikki", memberships: { create: { businessId: business.id, role: "CASHIER" } } } });

  const otherOwner = await db.user.create({ data: { phone: OTHER_OWNER_PHONE, role: "BUSINESS_OWNER", firstName: "Boshqa" } });
  const other = await db.business.create({
    data: { ownerId: otherOwner.id, name: "Boshqa kafe", tin: TINS[1]!, kind: "CAFE", address: "Chilonzor 2", workingHours: "09–22", status: "APPROVED", submittedAt: new Date() },
  });
  const otherCashier = await db.user.create({ data: { phone: OTHER_CASHIER_PHONE, role: "CASHIER", firstName: "Begona", memberships: { create: { businessId: other.id, role: "CASHIER" } } } });
  const pendingOwner = await db.user.create({ data: { phone: PENDING_OWNER_PHONE, role: "BUSINESS_OWNER", firstName: "Kutyapti" } });
  await db.business.create({ data: { ownerId: pendingOwner.id, name: "Kutilayotgan", tin: TINS[2]!, kind: "CAFE", address: "Yunusobod 3", workingHours: "10–20", status: "PENDING", submittedAt: new Date() } });

  const category = await db.category.findFirstOrThrow({ where: { slug: "taom" } });
  const discount = await db.discount.create({
    data: {
      businessId: business.id,
      categoryId: category.id,
      title: "Biz test osh",
      type: "PERCENT",
      originalPrice: 40000,
      percent: 25,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      fromMinute: Math.max(0, now.minute - 60),
      toMinute: Math.min(1440, now.minute + 60),
      dailyLimit: 20,
      perStudentLimit: "UNLIMITED",
      startsOn: new Date(now.date.getTime() - DAY_MS),
      endsOn: new Date(now.date.getTime() + 10 * DAY_MS),
      status: "ACTIVE",
    },
  });
  Object.assign(ids, { student: student.id, owner: owner.id, business: business.id, cashier: cashier.id, cashier2: cashier2.id, other: other.id, discount: discount.id });
  // Parolsiz hisob API'da ichkariga kirmaydi (`password_setup_required`)
  await db.user.updateMany({
    where: { id: { in: [student.id, owner.id, cashier.id, cashier2.id, otherOwner.id, otherCashier.id, pendingOwner.id] } },
    data: { passwordHash: hashPassword("Sinov2026") },
  });
  Object.assign(t, {
    student: (await openApiSession(student.id)).accessToken,
    owner: (await openApiSession(owner.id)).accessToken,
    cashier: (await openApiSession(cashier.id)).accessToken,
    cashier2: (await openApiSession(cashier2.id)).accessToken,
    otherOwner: (await openApiSession(otherOwner.id)).accessToken,
    otherCashier: (await openApiSession(otherCashier.id)).accessToken,
    pendingOwner: (await openApiSession(pendingOwner.id)).accessToken,
  });
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("API biznes: rollar", () => {
  it("talaba biznes bo'limiga kira olmaydi", async () => {
    expect((await call(statsRoute, "/api/v1/business/stats", { auth: t.student })).json.error.code).toBe("forbidden");
    expect((await call(scanRoute, "/api/v1/business/scan", { method: "POST", body: { qr: "x" }, auth: t.student })).json.error.code).toBe("forbidden");
  });

  it("tasdiqlanmagan biznes egasi — business_not_ready", async () => {
    const res = await call(statsRoute, "/api/v1/business/stats", { auth: t.pendingOwner });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("business_not_ready");
    expect((await call(scanRoute, "/api/v1/business/scan", { method: "POST", body: { qr: "x" }, auth: t.pendingOwner })).json.error.code).toBe("business_not_ready");
  });

  it("kassir faqat skaner va sotuvlar: statistika, chegirmalar, kassirlar — yo'q", async () => {
    for (const handler of [statsRoute, discountsRoute, cashiersRoute, profileRoute, ordersRoute]) {
      expect((await call(handler, "/api/v1/business/x", { auth: t.cashier })).json.error.code).toBe("forbidden");
    }
    expect((await call(salesRoute, "/api/v1/business/sales", { auth: t.cashier })).status).toBe(200);
  });
});

describe("API biznes: skaner va sotuv", () => {
  it("QR → ko'rib chiqish → tasdiqlash → chek; takror skan rad etiladi", async () => {
    const { coupon, qr } = await freshCoupon();
    const scan = await call(scanRoute, "/api/v1/business/scan", { method: "POST", body: { qr }, auth: t.cashier });
    expect(scan.status).toBe(200);
    expect(scan.json).toMatchObject({ kind: "coupon", preview: { couponId: coupon.id, finalPrice: 30000, student: { name: "Biz Talaba" } } });

    const confirm = await call(confirmRoute, "/api/v1/business/scan/confirm", {
      method: "POST",
      body: { couponId: coupon.id, ticket: scan.json.preview.ticket, paymentType: "CASH" },
      auth: t.cashier,
    });
    expect(confirm.status).toBe(201);
    expect(confirm.json.receipt).toMatchObject({ paidAmount: 30000, discountAmount: 10000, item: "Biz test osh" });
    expect(confirm.json.pdfUrl).toMatch(/^\/api\/v1\/files\/receipt\//);
    ids.receipt = confirm.json.receipt.id;

    const again = await call(scanRoute, "/api/v1/business/scan", { method: "POST", body: { qr }, auth: t.cashier });
    expect(again.status).toBe(409);
    expect(again.json.error).toMatchObject({ code: "scan_replayed", result: "REPLAYED" });
  });

  it("begona biznes kassiri — scan_wrong_business; buzilgan ticket — scan_ticket", async () => {
    const { coupon, qr } = await freshCoupon();
    const foreign = await call(scanRoute, "/api/v1/business/scan", { method: "POST", body: { qr }, auth: t.otherCashier });
    expect(foreign.json.error.code).toBe("scan_wrong_business");
    const bad = await call(confirmRoute, "/api/v1/business/scan/confirm", { method: "POST", body: { couponId: coupon.id, ticket: "1.x", paymentType: "CARD" }, auth: t.cashier });
    expect(bad.json.error.code).toBe("scan_ticket");
  });

  it("qo'lda: kod + 6 raqam (egasi ham skanerlaydi); noto'g'ri kod — qolgan urinishlar bilan", async () => {
    const { coupon, totp } = await freshCoupon();
    const wrong = await call(scanRoute, "/api/v1/business/scan", { method: "POST", body: { code: coupon.code, totp: totp === "000000" ? "111111" : "000000" }, auth: t.owner });
    expect(wrong.json.error).toMatchObject({ code: "scan_invalid", attemptsLeft: 4 });
    const right = await call(scanRoute, "/api/v1/business/scan", { method: "POST", body: { code: coupon.code, totp }, auth: t.owner });
    expect(right.json.preview.couponId).toBe(coupon.id);
    const sold = await call(confirmRoute, "/api/v1/business/scan/confirm", { method: "POST", body: { couponId: coupon.id, ticket: right.json.preview.ticket, paymentType: "QR" }, auth: t.cashier2 });
    // Ticket skanerlagan xodimga bog'langan — boshqa kassir tasdiqlay olmaydi
    expect(sold.json.error.code).toBe("scan_ticket");
    expect((await call(confirmRoute, "/api/v1/business/scan/confirm", { method: "POST", body: { couponId: coupon.id, ticket: right.json.preview.ticket, paymentType: "QR" }, auth: t.owner })).status).toBe(201);
  });

  it("sotuvlar: kassir faqat o'zinikini, egasi hammasini va xodim bo'yicha", async () => {
    const own = await call(salesRoute, "/api/v1/business/sales?period=1", { auth: t.cashier });
    expect(own.json.count).toBe(1);
    expect(own.json.staff).toBeNull();
    // Kassir boshqa xodim filtrini bera olmaydi
    expect((await call(salesRoute, `/api/v1/business/sales?period=1&cashier=${ids.owner}`, { auth: t.cashier })).json.count).toBe(1);
    expect((await call(salesRoute, "/api/v1/business/sales?period=1", { auth: t.cashier2 })).json.count).toBe(0);

    const all = await call(salesRoute, "/api/v1/business/sales?period=1", { auth: t.owner });
    expect(all.json.count).toBe(2);
    expect(all.json.staff.map((s: Json) => s.id)).toEqual(expect.arrayContaining([ids.owner, ids.cashier, ids.cashier2]));
    expect((await call(salesRoute, `/api/v1/business/sales?period=1&cashier=${ids.owner}`, { auth: t.owner })).json.count).toBe(1);
  });

  it("chek: talaba, egasi va tasdiqlagan kassir ko'radi; boshqa kassir va begona egasi — 404", async () => {
    const path = `/api/v1/receipts/${ids.receipt}`;
    const params = { id: ids.receipt };
    expect((await call(receiptRoute, path, { auth: t.student, params })).status).toBe(200);
    expect((await call(receiptRoute, path, { auth: t.owner, params })).status).toBe(200);
    expect((await call(receiptRoute, path, { auth: t.cashier, params })).status).toBe(200);
    expect((await call(receiptRoute, path, { auth: t.cashier2, params })).status).toBe(404);
    expect((await call(receiptRoute, path, { auth: t.otherOwner, params })).status).toBe(404);
  });

  it("chek PDF: imzoli havola ochiladi, buzilgani — 404", async () => {
    const { json } = await call(receiptRoute, `/api/v1/receipts/${ids.receipt}`, { auth: t.student, params: { id: ids.receipt } });
    const url = new URL(json.pdfUrl, "http://localhost");
    const pdf = await call(fileRoute, url.pathname + url.search, { params: { kind: "receipt", id: ids.receipt } });
    expect(pdf.status).toBe(200);
    expect(pdf.type).toBe("application/pdf");
    const forged = await call(fileRoute, url.pathname + url.search.replace(/sig=./, "sig=Z"), { params: { kind: "receipt", id: ids.receipt } });
    expect(forged.status).toBe(404);
    const otherKind = await call(fileRoute, url.pathname + url.search, { params: { kind: "logo", id: ids.receipt } });
    expect(otherKind.status).toBe(404);
  });

  it("statistika: bugungi sotuvlar va tushum, oxirgi sotuvlar", async () => {
    const res = await call(statsRoute, "/api/v1/business/stats?period=1", { auth: t.owner });
    expect(res.status).toBe(200);
    expect(res.json.kpi).toMatchObject({ sold: 2, revenue: 60000, fresh: 1 });
    expect(res.json.chart.hourly).toBe(true);
    expect(res.json.sales).toHaveLength(2);
    expect(res.json.funnel.sold).toBe(2);
    // Saytdagi issiqlik xaritasi: soat ustunlari va bo'sh bo'lmagan kataklar yig'indisi = 30 kunlik sotuvlar
    expect(res.json.heat.hours.length).toBeGreaterThan(0);
    expect(res.json.heat.cells.reduce((sum: number, c: number[]) => sum + c[2]!, 0)).toBe(2);
  });

  it("Excel hisobot: imzoli havola faqat egasining statistika javobida; buzilgani — 404", async () => {
    const { json } = await call(statsRoute, "/api/v1/business/stats?period=7", { auth: t.owner });
    const url = new URL(json.reportUrl, "http://localhost");
    const id = url.pathname.split("/").pop()!;
    const file = await call(fileRoute, url.pathname + url.search, { params: { kind: "report", id } });
    expect(file.status).toBe(200);
    expect(file.type).toContain("spreadsheetml");
    const forged = await call(fileRoute, url.pathname + url.search.replace(/sig=./, "sig=Z"), { params: { kind: "report", id } });
    expect(forged.status).toBe(404);
  });

  it("skaner sarlavhasi: biznes, kassir, bugungi sotuvlar va oxirgi sotuv; talabaga — forbidden", async () => {
    const res = await call(scanSummaryRoute, "/api/v1/business/scan", { auth: t.cashier });
    expect(res.status).toBe(200);
    expect(res.json.todaySales).toBe(2);
    expect(res.json.lastSale).toMatchObject({ item: expect.any(String), at: expect.any(String) });
    expect(res.json.cashierName).not.toBe("");
    expect((await call(scanSummaryRoute, "/api/v1/business/scan", { auth: t.student })).json.error.code).toBe("forbidden");
  });
});

describe("API biznes: chegirmalar", () => {
  const draft = (over: Json = {}) => {
    const today = toTashkent(new Date()).date.toISOString().slice(0, 10);
    const end = new Date(Date.parse(today) + 30 * DAY_MS).toISOString().slice(0, 10);
    return { title: "Ilova chegirmasi", type: "PERCENT", originalPrice: 20000, percent: 20, newPrice: null, weekdays: [1, 2, 3, 4, 5], fromMinute: 600, toMinute: 1200, dailyLimit: 30, perStudentLimit: "DAILY", startsOn: today, endsOn: end, terms: "", ...over };
  };

  it("saytdagi tekshiruv: xatolar maydon va sabab bilan", async () => {
    const res = await call(createDiscountRoute, "/api/v1/business/discounts", { method: "POST", body: { draft: draft({ percent: 0, weekdays: [], title: "ab" }), intent: "publish" }, auth: t.owner });
    expect(res.status).toBe(400);
    expect(res.json.error.problems).toMatchObject({ percent: "percentRange", weekdays: "weekdays", title: "title" });
  });

  it("yaratish → tekshiruvga; tahrirlash; rasm; begona egasi ko'rmaydi", async () => {
    const created = await call(createDiscountRoute, "/api/v1/business/discounts", { method: "POST", body: { draft: draft(), intent: "publish" }, auth: t.owner });
    expect(created.status).toBe(201);
    expect(created.json.status).toBe("PENDING_REVIEW");
    const id = created.json.id as string;

    const edited = await call(patchDiscountRoute, `/api/v1/business/discounts/${id}`, { method: "PATCH", body: { draft: draft({ dailyLimit: 50 }), intent: "draft" }, auth: t.owner, params: { id } });
    expect(edited.json.status).toBe("DRAFT");

    const form = new FormData();
    form.append("file", new Blob([PNG], { type: "image/png" }), "rasm.png");
    const image = await call(imageRoute, `/api/v1/business/discounts/${id}/images`, { method: "POST", form, auth: t.owner, params: { id } });
    expect(image.status).toBe(201);
    expect(image.json.url).toMatch(/^\/api\/v1\/files\/discount-image\//);

    const one = await call(discountRoute, `/api/v1/business/discounts/${id}`, { auth: t.owner, params: { id } });
    expect(one.json).toMatchObject({ status: "DRAFT", draft: { dailyLimit: 50 }, images: [{ id: image.json.id }] });
    expect(one.json.images[0].url).toMatch(/sig=/);
    expect((await call(discountRoute, `/api/v1/business/discounts/${id}`, { auth: t.otherOwner, params: { id } })).status).toBe(404);
    expect((await call(removeImageRoute, `/api/v1/business/discount-images/${image.json.id}`, { method: "DELETE", auth: t.otherOwner, params: { id: image.json.id } })).status).toBe(404);
    expect((await call(removeImageRoute, `/api/v1/business/discount-images/${image.json.id}`, { method: "DELETE", auth: t.owner, params: { id: image.json.id } })).status).toBe(200);

    // Qoralamani to'xtatib bo'lmaydi — faqat faol/to'xtatilgan
    expect((await call(activeRoute, `/api/v1/business/discounts/${id}/active`, { method: "POST", body: { active: false }, auth: t.owner, params: { id } })).json.error.code).toBe("not_editable");
  });

  it("faol chegirmani to'xtatish va yoqish; ro'yxatda bugungi sotuv", async () => {
    const id = ids.discount!;
    const paused = await call(activeRoute, `/api/v1/business/discounts/${id}/active`, { method: "POST", body: { active: false }, auth: t.owner, params: { id } });
    expect(paused.json.status).toBe("PAUSED");
    expect((await call(activeRoute, `/api/v1/business/discounts/${id}/active`, { method: "POST", body: { active: true }, auth: t.owner, params: { id } })).json.status).toBe("ACTIVE");
    const list = await call(discountsRoute, "/api/v1/business/discounts", { auth: t.owner });
    expect(list.json.discounts.find((d: Json) => d.id === id)).toMatchObject({ status: "ACTIVE", soldToday: 2 });
  });

  it("talaba chegirma rasmi ham imzoli havola bilan oladi", async () => {
    const image = await db.discountImage.create({ data: { discountId: ids.discount!, fileKey: "discounts/itest/none.jpg", sort: 0 } });
    const res = await call(dealRoute, `/api/v1/deals/${ids.discount}`, { auth: t.student, params: { id: ids.discount } });
    expect(res.json.deal.images[0]).toMatch(new RegExp(`^/api/v1/files/discount-image/${image.id}\\?exp=\\d+&sig=`));
    await db.discountImage.delete({ where: { id: image.id } });
  });
});

describe("API biznes: kassirlar", () => {
  it("telefon bilan taklif → kassir ilovada kiradi → ro'yxatda → faolsizlantirish sessiyani yopadi", async () => {
    const invite = await call(inviteRoute, "/api/v1/business/cashiers", { method: "POST", body: { phone: "+998 00 000 03 48" }, auth: t.owner });
    expect(invite.status).toBe(201);
    // Takror — o'sha taklif (muddati yangilanadi)
    expect((await call(inviteRoute, "/api/v1/business/cashiers", { method: "POST", body: { phone: NEW_CASHIER_PHONE }, auth: t.owner })).json.invite.id).toBe(invite.json.invite.id);
    expect((await call(inviteRoute, "/api/v1/business/cashiers", { method: "POST", body: { phone: CASHIER_PHONE }, auth: t.owner })).json.error.code).toBe("already_cashier");

    await db.otpCode.create({ data: { phone: NEW_CASHIER_PHONE, codeHash: hashOtp(NEW_CASHIER_PHONE, CODE, authSecret()), expiresAt: new Date(Date.now() + 5 * 60_000) } });
    const verified = await call(verifyRoute, "/api/v1/auth/verify", { method: "POST", body: { phone: NEW_CASHIER_PHONE, code: CODE, intent: "business" } });
    expect(verified.json).toMatchObject({ next: "setPassword", role: "cashier", isNew: true, businessName: "Biz test kafe" });
    const pw = await call(passwordRoute, "/api/v1/auth/password", { method: "POST", body: { ticket: verified.json.ticket, password: "kassa1234", confirm: "kassa1234" } });
    expect(pw.json).toMatchObject({ next: "register", role: "cashier" });
    // Talaba/biznes ro'yxati kassir tokeni bilan ochilmaydi
    const signed = await call(cashierRegisterRoute, "/api/v1/cashier/register", { method: "POST", body: { registrationTicket: pw.json.registrationTicket, firstName: "Yangi", lastName: "Kassir" } });
    expect(signed.status).toBe(201);
    expect(signed.json.user).toMatchObject({ role: "CASHIER", business: { id: ids.business, memberRole: "CASHIER" } });
    const cashierToken = signed.json.tokens.accessToken as string;

    const list = await call(cashiersRoute, "/api/v1/business/cashiers", { auth: t.owner });
    const member = list.json.cashiers.find((c: Json) => c.phone === NEW_CASHIER_PHONE);
    expect(member).toBeTruthy();
    expect(list.json.invites.find((i: Json) => i.id === invite.json.invite.id)).toBeUndefined();

    expect((await call(removeCashierRoute, `/api/v1/business/cashiers/${member.memberId}`, { method: "DELETE", auth: t.otherOwner, params: { id: member.memberId } })).status).toBe(404);
    expect((await call(removeCashierRoute, `/api/v1/business/cashiers/${member.memberId}`, { method: "DELETE", auth: t.owner, params: { id: member.memberId } })).status).toBe(200);
    expect((await call(meRoute, "/api/v1/me", { auth: cashierToken })).json.error.code).toBe("unauthorized");
  });

  it("taklifni bekor qilish; boshqa egasi bekor qila olmaydi", async () => {
    const invite = await call(inviteRoute, "/api/v1/business/cashiers", { method: "POST", body: { phone: "+998000000349" }, auth: t.owner });
    const id = invite.json.invite.id as string;
    expect((await call(revokeInviteRoute, `/api/v1/business/invites/${id}`, { method: "DELETE", auth: t.otherOwner, params: { id } })).status).toBe(404);
    expect((await call(revokeInviteRoute, `/api/v1/business/invites/${id}`, { method: "DELETE", auth: t.owner, params: { id } })).status).toBe(200);
  });
});

describe("API biznes: buyurtmalar va push", () => {
  it("buyurtmalar ro'yxati (yoqilmagan ham) va begona buyurtma — 404", async () => {
    const res = await call(ordersRoute, "/api/v1/business/orders?filter=new", { auth: t.owner });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ enabled: false, orders: [], newIds: [] });
    const missing = await call(orderRoute, "/api/v1/business/orders/zzzzzzzzzzzz", { method: "POST", body: { action: "accept" }, auth: t.owner, params: { id: "zzzzzzzzzzzz" } });
    expect(missing.json.error.code).toBe("not_found");
    const noReason = await call(orderRoute, "/api/v1/business/orders/zzzzzzzzzzzz", { method: "POST", body: { action: "reject", reason: " " }, auth: t.owner, params: { id: "zzzzzzzzzzzz" } });
    expect(noReason.json.error.fields).toEqual(["reason"]);
    // Kassir faqat "Berildi"
    expect((await call(orderRoute, "/api/v1/business/orders/zzzzzzzzzzzz", { method: "POST", body: { action: "accept" }, auth: t.cashier, params: { id: "zzzzzzzzzzzz" } })).json.error.code).toBe("forbidden");
  });

  it("Expo push: qurilmalarga yuboriladi, o'chirilgan ilova tokeni bazadan olinadi", async () => {
    const live = "ExponentPushToken[itest-biz-live]";
    const gone = "ExponentPushToken[itest-biz-gone]";
    await db.pushDevice.createMany({ data: [{ userId: ids.owner!, token: live, platform: "ANDROID" }, { userId: ids.owner!, token: gone, platform: "IOS" }, { userId: ids.owner!, token: "fcm-raw-token-not-expo", platform: "ANDROID" }] });
    let sentBody: Json[] = [];
    const message = expoFromWebPayload(JSON.stringify({ title: "Yangi buyurtma", body: "Osh × 2", url: "/uz/biznes/buyurtmalar", tag: "n1" }))!;
    const sent = await sendExpoPush([ids.owner!], message, async (_url, init) => {
      sentBody = JSON.parse(String(init.body)) as Json[];
      return new Response(JSON.stringify({ data: sentBody.map((m) => (m.to === gone ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: TICKET })) }), { status: 200 });
    });
    expect(sent).toBe(1);
    expect(sentBody.map((m) => m.to).sort()).toEqual([gone, live].sort());
    // Buyurtma — alohida Android kanali; badge — o'qilmaganlar soni
    expect(sentBody[0]).toMatchObject({ title: "Yangi buyurtma", data: { url: "/uz/biznes/buyurtmalar" }, sound: "default", channelId: "orders", badge: expect.any(Number) });
    expect(await db.pushDevice.count({ where: { token: gone } })).toBe(0);
    expect(await db.pushTicket.count({ where: { id: TICKET } })).toBe(1);

    // 15 daqiqadan keyin kvitansiya: ilova o'chirilgan — qurilma va ticket o'chadi
    const later = new Date(Date.now() + 16 * 60_000);
    const removed = await checkExpoReceipts(later, async (_url, init) => {
      const { ids: asked } = JSON.parse(String(init.body)) as { ids: string[] };
      expect(asked).toContain(TICKET);
      return new Response(JSON.stringify({ data: { [TICKET]: { status: "error", details: { error: "DeviceNotRegistered" } } } }), { status: 200 });
    });
    expect(removed).toBe(1);
    expect(await db.pushDevice.count({ where: { token: live } })).toBe(0);
    expect(await db.pushTicket.count({ where: { id: TICKET } })).toBe(0);
    await db.pushDevice.deleteMany({ where: { userId: ids.owner! } });
  });

  it("sotuv tasdiqlanganda talabaga xabar (chek havolasi bilan)", async () => {
    await notifyRedeemed(ids.receipt!);
    const inbox = await db.userNotification.findMany({ where: { userId: ids.student! }, select: { notification: { select: { title: true, body: true } } } });
    expect(inbox.some((n) => n.notification.title.includes("Biz test kafe") && n.notification.body.includes("30 000"))).toBe(true);
  });
});

describe("API biznes: oldindan band qilish sozlamalari", () => {
  it("sozlamalar: o'qish, saqlash (jadvalsiz yoqilmaydi), bugun to'xtatish; faqat egasi", async () => {
    const res = await call(preorderRoute, "/api/v1/business/preorder", { auth: t.owner });
    expect(res.status).toBe(200);
    expect(res.json.settings).toMatchObject({ enabled: false });
    expect(res.json.discounts.some((d: Json) => d.id === ids.discount)).toBe(true);
    expect((await call(preorderRoute, "/api/v1/business/preorder", { auth: t.cashier })).json.error.code).toBe("forbidden");

    const noSchedule = await call(savePreorderRoute, "/api/v1/business/preorder", { method: "PUT", body: { ...DEFAULT_SETTINGS, enabled: true, schedule: [] }, auth: t.owner });
    expect(noSchedule.json.error.code).toBe("preorder_no_schedule");
    const saved = await call(savePreorderRoute, "/api/v1/business/preorder", { method: "PUT", body: { ...DEFAULT_SETTINGS, enabled: true, autoConfirm: false }, auth: t.owner });
    expect(saved.json).toEqual({ ok: true });
    expect(await db.preorderSettings.findUnique({ where: { businessId: ids.business! }, select: { enabled: true, autoConfirm: true } })).toEqual({ enabled: true, autoConfirm: false });

    expect((await call(pauseRoute, "/api/v1/business/preorder/pause", { method: "POST", body: { paused: true }, auth: t.owner })).json).toEqual({ ok: true, paused: true });
    expect((await call(preorderRoute, "/api/v1/business/preorder", { auth: t.owner })).json.pausedToday).toBe(true);
    await call(pauseRoute, "/api/v1/business/preorder/pause", { method: "POST", body: { paused: false }, auth: t.owner });
    expect(await db.auditLog.count({ where: { entityId: ids.business!, action: { in: ["preorder.settings", "preorder.pause", "preorder.resume"] } } })).toBeGreaterThanOrEqual(3);
    // Keyingi testlar (profil) uchun — o'chiq holatga qaytariladi
    await call(savePreorderRoute, "/api/v1/business/preorder", { method: "PUT", body: DEFAULT_SETTINGS, auth: t.owner });
  });

  it("chegirma rejimi va jonli preview: saqlanmagan qoidalar bilan hisob; begona chegirma — 404", async () => {
    const draft = { ...DEFAULT_DISCOUNT_BOOKING, bookingMode: "PREPAID_PICKUP", validDays: 5, stock: 7, perStudentMax: 3, expireKeepPercent: 50 };
    const preview = await call(previewRoute, "/api/v1/business/preorder/preview", { method: "POST", body: { settings: DEFAULT_SETTINGS, paused: false, discountId: ids.discount, draft }, auth: t.owner });
    expect(preview.status).toBe(200);
    expect(preview.json).toMatchObject({ kind: "PREPAID_PICKUP", quantity: 3, prepay: "FULL", rules: { keepPercent: 50, freeCancelMinutes: 0 } });
    expect(preview.json.amounts.prepayAmount).toBe(preview.json.amounts.totalFinal);

    const save = await call(bookingRoute, `/api/v1/business/discounts/${ids.discount}/booking`, { method: "PUT", body: draft, auth: t.owner, params: { id: ids.discount } });
    expect(save.json).toEqual({ ok: true });
    expect(await db.discount.findUnique({ where: { id: ids.discount! }, select: { bookingMode: true, stock: true } })).toEqual({ bookingMode: "PREPAID_PICKUP", stock: 7 });
    expect(await db.auditLog.count({ where: { entityId: ids.discount!, action: "discount.booking" } })).toBe(1);

    const other = await db.discount.findFirstOrThrow({ where: { business: { ownerId: { not: ids.owner! } } }, select: { id: true } });
    expect((await call(bookingRoute, `/api/v1/business/discounts/${other.id}/booking`, { method: "PUT", body: draft, auth: t.owner, params: { id: other.id } })).json.error.code).toBe("not_found");
    expect((await call(previewRoute, "/api/v1/business/preorder/preview", { method: "POST", body: { settings: DEFAULT_SETTINGS, paused: false, discountId: other.id, draft }, auth: t.owner })).json.error.code).toBe("not_found");
    await db.discount.update({ where: { id: ids.discount! }, data: { bookingMode: "NONE" } });
  });
});

describe("API biznes: profil", () => {
  it("aloqa tekshiruvsiz; nom o'zgarsa qayta tekshiruv va bo'limlar yopiladi", async () => {
    const before = await call(profileRoute, "/api/v1/business/profile", { auth: t.owner });
    expect(before.json.profile).toMatchObject({ name: "Biz test kafe", salesToday: 2, preorderEnabled: false, logoUrl: null });
    const base = { name: "Biz test kafe", address: "Bunyodkor 1", workingHours: "09–22", description: "" };

    const bad = await call(editProfileRoute, "/api/v1/business/profile", { method: "PATCH", body: { ...base, telegram: "@@ yomon" }, auth: t.owner });
    expect(bad.json.error.fields).toContain("telegram");
    const contacts = await call(editProfileRoute, "/api/v1/business/profile", { method: "PATCH", body: { ...base, phone: "+998901112233", telegram: "@bizkafe", instagram: "" }, auth: t.owner });
    expect(contacts.json).toEqual({ ok: true, rereview: false });

    const renamed = await call(editProfileRoute, "/api/v1/business/profile", { method: "PATCH", body: { ...base, name: "Biz yangi kafe" }, auth: t.owner });
    expect(renamed.json).toEqual({ ok: true, rereview: true });
    expect((await call(statsRoute, "/api/v1/business/stats", { auth: t.owner })).json.error.code).toBe("business_not_ready");
    expect((await call(meRoute, "/api/v1/me", { auth: t.owner })).json.user.business).toMatchObject({ status: "PENDING", submitted: true });
  });
});
