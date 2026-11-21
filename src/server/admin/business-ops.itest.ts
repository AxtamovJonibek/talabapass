import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { toTashkent } from "@/lib/time";
import { businessSales } from "../business/sales";
import { businessStats } from "../business/stats";
import { db } from "../db";
import { addCashierByAdmin, adminCashiers, adminDiscountList, blockCashierAsAdmin, createDiscountByAdmin, duplicateDiscountByAdmin, ownerChanges, removeCashierAsAdmin, voidSale } from "./business-ops";
import { deleteDiscountByAdmin, saveDiscountByAdmin, setDiscountStatusByAdmin } from "./super";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

// Faqat shu test yaratadigan yozuvlar ("itest_ops" prefiksi)
const ADMIN = "itest_ops_admin";
const OWNER = "itest_ops_owner";
const STUDENT = "itest_ops_student";
const CASHIER = "itest_ops_cashier";
const BIZ = "itest_ops_biz";
const PHONES = ["+998000000951", "+998000000952", "+998000000953", "+998000000954", "+998000000955"];
const USERS = [ADMIN, OWNER, STUDENT, CASHIER];

const day = (offset: number) => new Date(toTashkent(new Date()).date.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const draft = (over: Record<string, unknown> = {}) => ({
  title: "Itest lavash",
  type: "PERCENT" as const,
  originalPrice: 30_000,
  percent: 20,
  newPrice: null,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  fromMinute: 540,
  toMinute: 1260,
  dailyLimit: 10,
  perStudentLimit: "DAILY" as const,
  startsOn: day(0),
  endsOn: day(30),
  terms: "",
  ...over,
});

async function cleanup() {
  await db.redemption.deleteMany({ where: { businessId: BIZ } });
  await db.coupon.deleteMany({ where: { discount: { businessId: BIZ } } });
  await db.discount.deleteMany({ where: { businessId: BIZ } });
  await db.cashierInvite.deleteMany({ where: { businessId: BIZ } });
  await db.businessMember.deleteMany({ where: { businessId: BIZ } });
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: ADMIN }, { meta: { path: ["businessId"], equals: BIZ } }] } });
  await db.business.deleteMany({ where: { id: BIZ } });
  await db.session.deleteMany({ where: { userId: { in: USERS } } });
  await db.user.deleteMany({ where: { id: { in: USERS } } });
}

beforeEach(async () => {
  await cleanup();
  await db.user.createMany({
    data: [
      { id: ADMIN, phone: PHONES[0], role: "ADMIN", firstName: "Itest", lastName: "Admin" },
      { id: OWNER, phone: PHONES[1], role: "BUSINESS_OWNER" },
      { id: STUDENT, phone: PHONES[2], role: "STUDENT", firstName: "Ali", lastName: "Valiyev" },
      { id: CASHIER, phone: PHONES[3], role: "CASHIER", firstName: "Jasur", lastName: "Kassir" },
    ],
  });
  await db.business.create({ data: { id: BIZ, ownerId: OWNER, name: "Itest Ops", kind: "CAFE", address: "Itest 1", workingHours: "Har kuni · 09:00–21:00", status: "APPROVED", submittedAt: new Date(), tin: "951000001" } });
  await db.businessMember.create({ data: { businessId: BIZ, userId: CASHIER, role: "CASHIER" } });
});
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

/** Sotuv: chegirma + kupon + chek (kassir tasdiqlagandek) */
async function makeSale(discountId: string, receiptNo = 1) {
  const date = toTashkent(new Date()).date;
  const coupon = await db.coupon.create({
    data: { code: `ITEST-OPS-${receiptNo}`, discountId, studentId: STUDENT, date, status: "REDEEMED", secret: Buffer.alloc(20), expiresAt: new Date(Date.now() + 600_000), termsTitle: "Itest lavash", termsType: "PERCENT" },
  });
  await db.$executeRaw`INSERT INTO "DiscountDay" ("discountId", date, claimed, redeemed) VALUES (${discountId}, ${date}::date, 1, 1) ON CONFLICT ("discountId", date) DO UPDATE SET redeemed = 1`;
  return db.redemption.create({
    data: { couponId: coupon.id, receiptNo, businessId: BIZ, discountId, studentId: STUDENT, cashierId: CASHIER, originalPrice: 30_000, discountAmount: 6_000, paidAmount: 24_000, paymentType: "CASH" },
  });
}

describe("admin: chegirmalar", () => {
  it("yaratadi (faol), noto'g'ri qiymatda hech narsa yozmaydi, jurnalga yozadi", async () => {
    const bad = await createDiscountByAdmin(ADMIN, BIZ, draft({ percent: 150 }));
    expect(bad).toMatchObject({ ok: false, error: "errors", errors: { percent: "percentRange" } });
    expect(await db.discount.count({ where: { businessId: BIZ } })).toBe(0);

    const ok = await createDiscountByAdmin(ADMIN, BIZ, draft());
    expect(ok.ok).toBe(true);
    const list = await adminDiscountList(BIZ);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ status: "ACTIVE", dailyLimit: 10, sold: 0 });
    expect(await db.auditLog.count({ where: { actorId: ADMIN, action: "discount.create.admin" } })).toBe(1);
    expect((await ownerChanges(BIZ))[0]).toMatchObject({ by: "admin", field: "discount_created", newValue: "Itest lavash" });
  });

  it("xato chegirmani tahrirlaydi: oldin → keyin egasi jurnalida, holat o'zgarmaydi", async () => {
    const created = await createDiscountByAdmin(ADMIN, BIZ, draft({ percent: 99 }));
    const id = created.ok ? created.id! : "";
    expect(await saveDiscountByAdmin(ADMIN, id, draft({ percent: 20, dailyLimit: 15 }))).toEqual({ ok: true });
    expect(await db.discount.findUniqueOrThrow({ where: { id } })).toMatchObject({ percent: 20, dailyLimit: 15, status: "ACTIVE" });
    const log = await ownerChanges(BIZ);
    expect(log.find((c) => c.field === "discount_percent")).toMatchObject({ by: "admin", oldValue: "«Itest lavash»: 99", newValue: "«Itest lavash»: 20" });
    expect(log.find((c) => c.field === "discount_dailyLimit")).toMatchObject({ oldValue: "«Itest lavash»: 10", newValue: "«Itest lavash»: 15" });
  });

  it("to'xtatadi/davom ettiradi, nusxalaydi (to'xtatilgan), o'chiradi", async () => {
    const created = await createDiscountByAdmin(ADMIN, BIZ, draft());
    const id = created.ok ? created.id! : "";
    expect(await setDiscountStatusByAdmin(ADMIN, id, false)).toEqual({ ok: true });
    expect((await db.discount.findUniqueOrThrow({ where: { id } })).status).toBe("PAUSED");
    expect(await setDiscountStatusByAdmin(ADMIN, id, true)).toEqual({ ok: true });

    const copy = await duplicateDiscountByAdmin(ADMIN, id);
    const copyRow = await db.discount.findUniqueOrThrow({ where: { id: copy.ok ? copy.id! : "" } });
    expect(copyRow).toMatchObject({ status: "PAUSED", title: "Itest lavash (nusxa)", percent: 20, businessId: BIZ });

    expect(await deleteDiscountByAdmin(ADMIN, copyRow.id)).toEqual({ ok: true });
    expect(await db.discount.count({ where: { businessId: BIZ } })).toBe(1);
    const fields = (await ownerChanges(BIZ)).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(["discount_status", "discount_duplicated", "discount_deleted"]));
  });
});

describe("admin: sotuvni bekor qilish", () => {
  it("sabab majburiy; bekor qilingan sotuv tushum va statistikadan chiqadi; ikkinchi marta emas", async () => {
    const created = await createDiscountByAdmin(ADMIN, BIZ, draft());
    const discountId = created.ok ? created.id! : "";
    const sale = await makeSale(discountId);
    await makeSale(discountId, 2).catch(() => undefined);

    expect(await voidSale(ADMIN, { redemptionId: sale.id, reason: "ab" })).toMatchObject({ ok: false, fields: ["reason"] });
    expect((await businessStats(BIZ, 30)).kpi.sold).toBeGreaterThanOrEqual(1);

    const before = (await businessStats(BIZ, 30)).kpi;
    expect(await voidSale(ADMIN, { redemptionId: sale.id, reason: "Narx xato kiritilgan" })).toEqual({ ok: true });
    const after = (await businessStats(BIZ, 30)).kpi;
    expect(after.sold).toBe(before.sold - 1);
    expect(after.revenue).toBe(before.revenue - 24_000);

    // Egasi ro'yxatida yo'q, adminda "bekor qilingan" sifatida
    const ownerView = await businessSales(BIZ, 30, 1);
    expect(ownerView.rows.find((r) => r.id === sale.id)).toBeUndefined();
    const adminView = await businessSales(BIZ, 30, 1, new Date(), undefined, true);
    expect(adminView.rows.find((r) => r.id === sale.id)).toMatchObject({ voided: { reason: "Narx xato kiritilgan" }, studentFull: "Ali Valiyev" });

    expect(await voidSale(ADMIN, { redemptionId: sale.id, reason: "Yana bekor" })).toMatchObject({ ok: false });
    expect(await db.auditLog.count({ where: { action: "redemption.void.admin", entityId: sale.id } })).toBe(1);
    expect((await ownerChanges(BIZ)).find((c) => c.field === "sale_voided")).toMatchObject({ by: "admin", newValue: "Narx xato kiritilgan" });
    const day = await db.discountDay.findFirstOrThrow({ where: { discountId } });
    expect(day.redeemed).toBe(0);
  });
});

describe("admin: kassirlar", () => {
  it("raqam bilan taklif, bloklash, o'chirish — jurnalga yoziladi", async () => {
    expect(await addCashierByAdmin(ADMIN, { businessId: BIZ, phone: "abc" })).toMatchObject({ ok: false, error: "invalid" });
    expect(await addCashierByAdmin(ADMIN, { businessId: BIZ, phone: "+998000000955" })).toMatchObject({ ok: true });
    expect(await addCashierByAdmin(ADMIN, { businessId: BIZ, phone: PHONES[3] })).toMatchObject({ ok: false, error: "alreadyCashier" });

    const data = await adminCashiers(BIZ);
    expect(data.invites).toHaveLength(1);
    expect(data.cashiers).toHaveLength(1);

    expect(await blockCashierAsAdmin(ADMIN, BIZ, CASHIER, true, "")).toMatchObject({ ok: false, fields: ["reason"] });
    expect(await blockCashierAsAdmin(ADMIN, BIZ, CASHIER, true, "Shubhali skan")).toEqual({ ok: true });
    expect((await adminCashiers(BIZ)).cashiers[0]).toMatchObject({ blocked: true });
    expect(await blockCashierAsAdmin(ADMIN, BIZ, CASHIER, false, "")).toEqual({ ok: true });

    const member = (await adminCashiers(BIZ)).cashiers[0]!;
    expect(await removeCashierAsAdmin(ADMIN, BIZ, member.memberId)).toEqual({ ok: true });
    expect((await adminCashiers(BIZ)).cashiers).toHaveLength(0);
    const fields = (await ownerChanges(BIZ)).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(["cashier_added", "cashier_blocked", "cashier_unblocked", "cashier_removed"]));
  });

  it("begona biznes a'zosini o'chirib bo'lmaydi", async () => {
    const member = (await adminCashiers(BIZ)).cashiers[0]!;
    expect(await removeCashierAsAdmin(ADMIN, "boshqa_biznes", member.memberId)).toMatchObject({ ok: false, error: "notFound" });
  });
});
