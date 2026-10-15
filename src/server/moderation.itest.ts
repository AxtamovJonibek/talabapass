import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { blockBusiness, blockUser, unblockBusiness, unblockUser } from "./moderation";

// Faqat shu test yaratadigan yozuvlar ("itest_" prefiksi)
const IDS = { admin: "itest_admin", student: "itest_student", owner: "itest_owner", cashier: "itest_cashier", outsider: "itest_outsider" };
const BUSINESS = "itest_business";
const UNIVERSITY = "itest_mod_university";

async function cleanup() {
  const users = Object.values(IDS);
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { entityId: { in: [...users, BUSINESS] } }] } });
  await db.business.deleteMany({ where: { id: BUSINESS } });
  await db.studentProfile.deleteMany({ where: { userId: IDS.student } });
  await db.university.deleteMany({ where: { id: UNIVERSITY } });
  await db.user.deleteMany({ where: { id: { in: users } } });
}

async function session(userId: string, n: number) {
  await db.session.create({ data: { userId, tokenHash: `itest_${userId}_${n}`, expiresAt: new Date(Date.now() + 86_400_000) } });
}
const sessionsOf = (userId: string) => db.session.count({ where: { userId } });

beforeEach(async () => {
  await cleanup();
  await db.user.createMany({
    data: [
      { id: IDS.admin, phone: "+998000000201", role: "ADMIN" },
      { id: IDS.student, phone: "+998000000202", role: "STUDENT" },
      { id: IDS.owner, phone: "+998000000203", role: "BUSINESS_OWNER" },
      { id: IDS.cashier, phone: "+998000000204", role: "CASHIER" },
      { id: IDS.outsider, phone: "+998000000205", role: "CASHIER" },
    ],
  });
  await db.business.create({
    data: {
      id: BUSINESS, ownerId: IDS.owner, name: "itest biznes", kind: "CAFE", address: "test", workingHours: "09:00–18:00", status: "APPROVED",
      members: { create: [{ userId: IDS.owner, role: "OWNER" }, { userId: IDS.cashier, role: "CASHIER" }] },
    },
  });
  // Har bir foydalanuvchida ikkitadan sessiya (ikki qurilma)
  for (const id of Object.values(IDS)) {
    await session(id, 1);
    await session(id, 2);
  }
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("bloklash sessiyalarni darhol yopadi", () => {
  it("foydalanuvchi bloklansa uning barcha sessiyalari o'chadi, boshqalarniki qoladi", async () => {
    await blockUser(IDS.student, "soxta guvohnoma", IDS.admin);

    expect(await sessionsOf(IDS.student)).toBe(0);
    const user = await db.user.findUniqueOrThrow({ where: { id: IDS.student } });
    expect(user.status).toBe("BLOCKED");
    expect(user.blockedReason).toBe("soxta guvohnoma");

    for (const id of [IDS.admin, IDS.owner, IDS.cashier, IDS.outsider]) expect(await sessionsOf(id), id).toBe(2);
  });

  it("biznes bloklansa egasi va barcha kassirlarining sessiyalari o'chadi", async () => {
    await blockBusiness(BUSINESS, "chegirmani bajarmadi", IDS.admin);

    expect((await db.business.findUniqueOrThrow({ where: { id: BUSINESS } })).status).toBe("BLOCKED");
    expect(await sessionsOf(IDS.owner)).toBe(0);
    expect(await sessionsOf(IDS.cashier)).toBe(0);
    // shu biznesga aloqasi yo'q foydalanuvchilar ta'sirlanmaydi
    expect(await sessionsOf(IDS.outsider)).toBe(2);
    expect(await sessionsOf(IDS.student)).toBe(2);
    expect(await sessionsOf(IDS.admin)).toBe(2);
  });

  it("har ikki amal audit log'ga yoziladi", async () => {
    await blockUser(IDS.student, "sabab", IDS.admin);
    await blockBusiness(BUSINESS, "sabab", IDS.admin);
    const logs = await db.auditLog.findMany({ where: { actorId: IDS.admin }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["user.block", "business.block"]);
  });

  it("bloklash yarim bajarilmaydi: mavjud bo'lmagan foydalanuvchida hech narsa o'zgarmaydi", async () => {
    await expect(blockUser("itest_yoq", "sabab", IDS.admin)).rejects.toThrow();
    expect(await db.auditLog.count({ where: { actorId: IDS.admin } })).toBe(0);
  });
});

describe("blokdan chiqarish", () => {
  const NOW = new Date("2026-10-15T09:00:00Z");
  async function profile(data: { status: "APPROVED" | "BLOCKED"; cardNumber: string | null; cardExpiresAt: Date | null }) {
    await db.university.create({ data: { id: UNIVERSITY, name: "itest_mod_universitet", shortName: "MOD" } });
    await db.studentProfile.create({ data: { userId: IDS.student, universityId: UNIVERSITY, course: "C1", publicId: "itest_mod_pub", ...data } });
  }

  it("guvohnomasi amalda talaba: ACTIVE va APPROVED; sessiyalar qaytmaydi; audit yoziladi", async () => {
    await profile({ status: "APPROVED", cardNumber: "ITEST-MOD-1", cardExpiresAt: new Date("2027-06-01") });
    await blockUser(IDS.student, "sabab", IDS.admin);
    expect(await unblockUser(IDS.student, IDS.admin, NOW)).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { id: IDS.student }, include: { student: true } });
    expect(user).toMatchObject({ status: "ACTIVE", blockedReason: null });
    expect(user.student?.status).toBe("APPROVED");
    expect(await sessionsOf(IDS.student)).toBe(0);
    expect(await db.auditLog.count({ where: { action: "user.unblock", entityId: IDS.student, actorId: IDS.admin } })).toBe(1);
  });

  it("guvohnoma muddati o'tgan talaba — EXPIRED; hech qachon tasdiqlanmagan — REJECTED", async () => {
    await profile({ status: "APPROVED", cardNumber: "ITEST-MOD-2", cardExpiresAt: new Date("2026-09-01") });
    await blockUser(IDS.student, "sabab", IDS.admin);
    await unblockUser(IDS.student, IDS.admin, NOW);
    expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: IDS.student } })).status).toBe("EXPIRED");

    await blockUser(IDS.student, "sabab", IDS.admin);
    await db.studentProfile.update({ where: { userId: IDS.student }, data: { cardNumber: null, cardExpiresAt: null } });
    await unblockUser(IDS.student, IDS.admin, NOW);
    expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: IDS.student } })).status).toBe("REJECTED");
  });

  it("bloklanmagan foydalanuvchida hech narsa o'zgarmaydi (audit ham yozilmaydi)", async () => {
    expect(await unblockUser(IDS.student, IDS.admin, NOW)).toBe(false);
    expect(await db.auditLog.count({ where: { action: "user.unblock", entityId: IDS.student } })).toBe(0);
  });

  it("biznes: ilgari tasdiqlangan — APPROVED, hech qachon ko'rilmagan — PENDING (navbatga qaytadi)", async () => {
    await db.auditLog.create({ data: { actorId: IDS.admin, action: "business.approve", entity: "Business", entityId: BUSINESS } });
    await blockBusiness(BUSINESS, "sabab", IDS.admin);
    expect(await unblockBusiness(BUSINESS, IDS.admin)).toBe(true);
    expect(await db.business.findUniqueOrThrow({ where: { id: BUSINESS } })).toMatchObject({ status: "APPROVED", rejectReason: null });

    await db.auditLog.deleteMany({ where: { action: "business.approve", entityId: BUSINESS } });
    await blockBusiness(BUSINESS, "sabab", IDS.admin);
    expect(await unblockBusiness(BUSINESS, IDS.admin)).toBe(true);
    expect((await db.business.findUniqueOrThrow({ where: { id: BUSINESS } })).status).toBe("PENDING");
  });

  it("bloklanmagan biznesni 'chiqarib' bo'lmaydi", async () => {
    expect(await unblockBusiness(BUSINESS, IDS.admin)).toBe(false);
    expect((await db.business.findUniqueOrThrow({ where: { id: BUSINESS } })).status).toBe("APPROVED");
  });
});
