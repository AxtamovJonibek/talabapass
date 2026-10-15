import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TX_PAGE_SIZE } from "@/lib/admin-transactions";
import { db } from "../db";
import { blockedBusinesses, blockedStudents } from "./blocked";
import { blockedCounts, businessRating, platformOverview } from "./overview";
import { transactionExport, transactionPage, transactionTotals } from "./transactions";

// Faqat shu test yaratadigan yozuvlar ("itest_adm_" prefiksi)
const P = "itest_adm_";
const IDS = { owner: `${P}owner`, cashier: `${P}cashier`, s1: `${P}s1`, s2: `${P}s2`, admin: `${P}admin` };
const BIZ = `${P}biz`;
const UNI = `${P}uni`;
const NAME = `${P}Bodom Choyxonasi`;
// 2026-10-15 14:30 Toshkent = 09:30 UTC
const NOW = new Date("2026-10-15T09:30:00Z");

async function cleanup() {
  const users = Object.values(IDS);
  await db.scanAttempt.deleteMany({ where: { businessId: BIZ } });
  await db.redemption.deleteMany({ where: { businessId: BIZ } });
  await db.coupon.deleteMany({ where: { studentId: { in: users } } });
  await db.discount.deleteMany({ where: { businessId: BIZ } });
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { entityId: { in: [...users, BIZ] } }] } });
  await db.business.deleteMany({ where: { id: BIZ } });
  await db.verification.deleteMany({ where: { studentId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.university.deleteMany({ where: { id: UNI } });
}

let discountId = "";
let seq = 0;

/** Bitta sotuv: kupon + chek. `at` — chek vaqti (UTC). */
async function sale(studentId: string, at: Date, paid: number, discountAmount: number) {
  seq++;
  const coupon = await db.coupon.create({
    data: {
      code: `${P}c${seq}`,
      discountId,
      studentId,
      date: new Date("2026-10-15"),
      status: "REDEEMED",
      secret: Buffer.from("x"),
      expiresAt: at,
      createdAt: at,
      termsTitle: "Osh 0.5 + choy",
      termsType: "PERCENT",
      termsOriginalPrice: paid + discountAmount,
    },
  });
  await db.redemption.create({
    data: {
      couponId: coupon.id,
      receiptNo: 4800 + seq,
      businessId: BIZ,
      discountId,
      studentId,
      cashierId: IDS.cashier,
      originalPrice: paid + discountAmount,
      discountAmount,
      paidAmount: paid,
      paymentType: "CASH",
      createdAt: at,
    },
  });
}

beforeEach(async () => {
  await cleanup();
  seq = 0;
  await db.university.create({ data: { id: UNI, name: `${P}Universitet`, shortName: "ITA" } });
  await db.user.createMany({
    data: [
      { id: IDS.owner, phone: "+998000000901", role: "BUSINESS_OWNER" },
      { id: IDS.cashier, phone: "+998000000902", role: "CASHIER", firstName: "Jasur", lastName: "Tursunov" },
      { id: IDS.s1, phone: "+998000000903", role: "STUDENT", firstName: "Dilnoza", lastName: "Karimova" },
      { id: IDS.s2, phone: "+998000000904", role: "STUDENT", firstName: "Otabek", lastName: "Nurmatov" },
      { id: IDS.admin, phone: "+998000000905", role: "ADMIN" },
    ],
  });
  for (const [id, n] of [[IDS.s1, 1], [IDS.s2, 2]] as const) {
    await db.studentProfile.create({ data: { userId: id, universityId: UNI, course: "C2", publicId: `${P}pub${n}`, status: "APPROVED", cardNumber: `${P}card${n}`, cardExpiresAt: new Date("2027-06-01") } });
  }
  await db.business.create({ data: { id: BIZ, ownerId: IDS.owner, name: NAME, tin: "999000111", kind: "CAFE", address: "test", workingHours: "09:00–18:00", status: "APPROVED", submittedAt: NOW } });
  const category = await db.category.upsert({ where: { slug: "taom" }, update: {}, create: { slug: "taom", name: "Taomlar", tileColor: "#F4DCCB", inkColor: "#8A3410", icon: "bowl" } });
  discountId = (
    await db.discount.create({
      data: {
        businessId: BIZ,
        categoryId: category.id,
        title: "Osh 0.5 + choy",
        type: "PERCENT",
        percent: 30,
        status: "ACTIVE",
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        fromMinute: 0,
        toMinute: 1439,
        startsOn: new Date("2026-01-01"),
        endsOn: new Date("2027-01-01"),
        dailyLimit: 100,
      },
    })
  ).id;
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("A1: umumiy ko'rsatkichlar", () => {
  it("bugungi sotuv, tejash va tushum qo'lda hisoblangan qiymatlarga farq qiladi; kechagi sotuv bugunga kirmaydi", async () => {
    const before = await platformOverview(NOW);
    await sale(IDS.s1, new Date("2026-10-15T08:00:00Z"), 26_600, 11_400);
    await sale(IDS.s2, new Date("2026-10-15T09:00:00Z"), 25_000, 20_000);
    // Toshkent kechasi 23:59 (UTC 18:59) — hali bugun; kecha 23:59 Toshkent (UTC 18:59 oldingi kun) — kecha
    await sale(IDS.s1, new Date("2026-10-14T18:59:00Z"), 100_000, 50_000);
    const after = await platformOverview(NOW);

    expect(after.kpi.salesToday - before.kpi.salesToday).toBe(2);
    expect(after.kpi.saved - before.kpi.saved).toBe(31_400);
    expect(after.kpi.revenue - before.kpi.revenue).toBe(51_600);
    // grafik: oxirgi kun — bugun, jami 30 kun
    expect(after.daily).toHaveLength(30);
    expect(after.daily.at(-1)!.key).toBe("2026-10-15");
    expect(after.daily.at(-1)!.sales - before.daily.at(-1)!.sales).toBe(2);
    expect(after.daily.at(-2)!.sales - before.daily.at(-2)!.sales).toBe(1);
  });

  it("bugungi tasdiqlangan yangi talabalar va tasdiqlangan talabalar soni", async () => {
    const before = await platformOverview(NOW);
    // s1: bugun (Toshkent) tasdiqlangan, s2 — kecha
    const verification = (studentId: string, reviewedAt: Date) =>
      db.verification.create({ data: { studentId, status: "APPROVED", reviewedAt, fileKey: `${P}f`, fileName: "a.jpg", fileSize: 1, mime: "image/jpeg" } });
    await verification(IDS.s1, new Date("2026-10-15T05:00:00Z"));
    await verification(IDS.s2, new Date("2026-10-13T05:00:00Z"));
    const after = await platformOverview(NOW);
    expect(after.kpi.newToday - before.kpi.newToday).toBe(1);
    expect(after.daily.at(-1)!.students - before.daily.at(-1)!.students).toBe(1);
    // tasdiqlangan talabalar soni — mustaqil so'rov bilan; bloklangan hisoblanmaydi
    const independent = () => db.studentProfile.count({ where: { status: "APPROVED", user: { status: "ACTIVE" } } });
    expect(after.kpi.students).toBe(await independent());
    await db.user.update({ where: { id: IDS.s2 }, data: { status: "BLOCKED" } });
    expect((await platformOverview(NOW)).kpi.students).toBe(after.kpi.students - 1);
  });

  it("reyting: sotuvlar va tejalgan summa; sotuvi borlar tepada", async () => {
    await sale(IDS.s1, new Date("2026-10-15T08:00:00Z"), 26_600, 11_400);
    await sale(IDS.s2, new Date("2026-10-10T08:00:00Z"), 25_000, 20_000);
    // 30 kundan eski sotuv hisobga olinmaydi
    await sale(IDS.s2, new Date("2026-08-01T08:00:00Z"), 1_000, 999);
    const row = (await businessRating(NOW, 500)).find((b) => b.id === BIZ);
    expect(row).toMatchObject({ name: NAME, sold: 2, saved: 31_400, offers: 1, status: "APPROVED" });
  });
});

describe("tranzaksiyalar", () => {
  const filter = (extra: Record<string, unknown> = {}) => ({ status: "all" as const, period: "all" as const, q: NAME, page: 1, ...extra });

  it("muvaffaqiyatli va rad etilgan skanlar bitta vaqt tartibida; jami summalar", async () => {
    await sale(IDS.s1, new Date("2026-10-15T08:00:00Z"), 26_600, 11_400);
    const coupon = await db.coupon.findFirstOrThrow({ where: { studentId: IDS.s1 } });
    await db.scanAttempt.create({ data: { businessId: BIZ, cashierId: IDS.cashier, couponId: coupon.id, result: "EXPIRED", createdAt: new Date("2026-10-15T08:30:00Z") } });
    await db.scanAttempt.create({ data: { businessId: BIZ, cashierId: IDS.cashier, result: "OK", createdAt: new Date("2026-10-15T08:45:00Z") } });

    const page = await transactionPage(filter(), NOW);
    expect(page.total).toBe(2); // OK skan tranzaksiya emas
    expect(page.rows.map((r) => [r.ok, r.reason])).toEqual([
      [false, "EXPIRED"],
      [true, null],
    ]);
    expect(page.rows[1]).toMatchObject({ student: "Dilnoza Karimova", university: "ITA", course: "C2", business: NAME, cashier: "Jasur T.", item: "Osh 0.5 + choy", original: 38_000, discount: 11_400, paid: 26_600, receiptNo: 4801 });
    expect(await transactionTotals(filter(), NOW)).toEqual({ paid: 26_600, discount: 11_400 });

    expect((await transactionPage(filter({ status: "ok" }), NOW)).rows.every((r) => r.ok)).toBe(true);
    expect((await transactionPage(filter({ status: "no" }), NOW)).rows.map((r) => r.reason)).toEqual(["EXPIRED"]);
  });

  it("qidiruv: chek №, talaba ismi (so'zlar bo'yicha), telefon, biznes nomi va STIR", async () => {
    await sale(IDS.s1, new Date("2026-10-15T08:00:00Z"), 26_600, 11_400);
    await sale(IDS.s2, new Date("2026-10-15T08:10:00Z"), 25_000, 20_000);
    // Bazada boshqa (seed) yozuvlar ham bor — faqat shu test biznesidagilari taqqoslanadi
    const find = async (q: string) => (await transactionPage(filter({ q }), NOW)).rows.filter((r) => r.business === NAME).map((r) => r.receiptNo);

    expect(await find("004801")).toEqual([4801]);
    expect(await find("Dilnoza")).toEqual([4801]);
    expect(await find("karimova dilnoza")).toEqual([4801]);
    expect(await find("+99800000090")).toEqual([4802, 4801]);
    expect(await find("999000111")).toEqual([4802, 4801]);
    expect(await find(`${P}bodom`)).toEqual([4802, 4801]);
    expect(await find("Mavjud emas")).toEqual([]);
  });

  it("davr filtri Toshkent kuni bo'yicha", async () => {
    await sale(IDS.s1, new Date("2026-10-15T08:00:00Z"), 1000, 100);
    await sale(IDS.s1, new Date("2026-10-14T18:59:00Z"), 1000, 100); // kecha 23:59 Toshkent
    expect((await transactionPage(filter({ period: "1" }), NOW)).total).toBe(1);
    expect((await transactionPage(filter({ period: "7" }), NOW)).total).toBe(2);
  });

  it("sahifalash: har sahifada TX_PAGE_SIZE, tartib barqaror, jami to'g'ri; eksport hammasini beradi", async () => {
    const total = TX_PAGE_SIZE + 5;
    await db.scanAttempt.createMany({
      data: Array.from({ length: total }, (_, i) => ({ businessId: BIZ, cashierId: IDS.cashier, result: "INVALID" as const, createdAt: new Date(NOW.getTime() - i * 60_000) })),
    });
    await sale(IDS.s1, new Date(NOW.getTime() - 3 * 60_000 - 30_000), 1000, 100);

    const first = await transactionPage(filter(), NOW);
    const second = await transactionPage(filter({ page: 2 }), NOW);
    expect(first.total).toBe(total + 1);
    expect(first.pages).toBe(2);
    expect(first.rows).toHaveLength(TX_PAGE_SIZE);
    expect(second.rows).toHaveLength(6);
    const ids = [...first.rows, ...second.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(total + 1); // takrorlanish ham, tushib qolish ham yo'q
    const times = [...first.rows, ...second.rows].map((r) => r.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect((await transactionExport(filter(), NOW)).rows).toHaveLength(total + 1);
  });
});

describe("bloklanganlar", () => {
  it("talaba va biznes: sabab, kim va qachon blokladi; sanoq yig'indisi", async () => {
    const before = await blockedCounts();
    await db.user.update({ where: { id: IDS.s1 }, data: { status: "BLOCKED", blockedReason: "fake" } });
    await db.auditLog.create({ data: { actorId: IDS.admin, action: "user.block", entity: "User", entityId: IDS.s1, createdAt: new Date("2026-10-14T10:00:00Z") } });
    await db.user.update({ where: { id: IDS.admin }, data: { firstName: "Aziza", lastName: "Mirzayeva" } });
    await db.business.update({ where: { id: BIZ }, data: { status: "BLOCKED", rejectReason: "tin" } });
    await db.auditLog.create({ data: { actorId: IDS.admin, action: "business.block", entity: "Business", entityId: BIZ } });

    const after = await blockedCounts();
    expect(after.students - before.students).toBe(1);
    expect(after.businesses - before.businesses).toBe(1);
    expect(after.total - before.total).toBe(2);

    const student = (await blockedStudents()).find((s) => s.id === IDS.s1)!;
    expect(student).toMatchObject({ name: "Dilnoza Karimova", reason: "fake", university: "ITA", by: "Aziza Mirzayeva" });
    expect(student.at?.toISOString()).toBe("2026-10-14T10:00:00.000Z");
    const business = (await blockedBusinesses()).find((b) => b.id === BIZ)!;
    expect(business).toMatchObject({ name: NAME, reason: "tin", by: "Aziza Mirzayeva" });
  });
});
