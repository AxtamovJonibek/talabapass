import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { audienceReach, audienceUserIds } from "./audience";
import { notifyUser } from "./direct";
import { inboxItems, markInboxRead, unreadCount } from "./inbox";
import { createNotification, dispatchDue, dispatchNotification, notificationHistory, STUCK_MINUTES } from "./send";

// Faqat shu test yaratadigan yozuvlar ("itest_n_" prefiksi)
const P = "itest_n_";
const ADMIN = `${P}admin`;
const UNI_A = `${P}uni_a`;
const UNI_B = `${P}uni_b`;
const DIST_A = `${P}dist_a`;
const DIST_B = `${P}dist_b`;
const BIZ = `${P}biz`;
const students = {
  a1: `${P}s_a1`, // UNI_A, tasdiqlangan
  a2: `${P}s_a2`, // UNI_A, tasdiqlangan
  b1: `${P}s_b1`, // UNI_B, tasdiqlangan
  blocked: `${P}s_blocked`, // UNI_A, bloklangan
  pending: `${P}s_pending`, // UNI_A, tasdiqlanmagan
};
const OWNER = `${P}owner`;
const OWNER_PENDING = `${P}owner_pending`;
const now = new Date("2026-10-15T09:00:00Z");

async function cleanup() {
  const users = [ADMIN, OWNER, OWNER_PENDING, ...Object.values(students)];
  const notifications = await db.notification.findMany({ where: { OR: [{ createdById: { in: users } }, { audienceIds: { hasSome: users } }] }, select: { id: true } });
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { entityId: { in: notifications.map((n) => n.id) } }] } });
  await db.notification.deleteMany({ where: { id: { in: notifications.map((n) => n.id) } } });
  await db.coupon.deleteMany({ where: { studentId: { in: users } } });
  await db.discount.deleteMany({ where: { businessId: BIZ } });
  await db.business.deleteMany({ where: { id: { in: [BIZ, `${BIZ}_pending`] } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.university.deleteMany({ where: { id: { in: [UNI_A, UNI_B] } } });
  await db.district.deleteMany({ where: { id: { in: [DIST_A, DIST_B] } } });
}

async function student(id: string, phone: string, universityId: string, status: "APPROVED" | "PENDING", blocked = false) {
  await db.user.create({
    data: {
      id,
      phone,
      role: "STUDENT",
      status: blocked ? "BLOCKED" : "ACTIVE",
      student: { create: { universityId, course: "C2", publicId: `${P}${id.slice(-6)}`, status: blocked ? "BLOCKED" : status } },
    },
  });
}

beforeEach(async () => {
  await cleanup();
  await db.university.createMany({
    data: [
      { id: UNI_A, name: `${P}Universitet A`, shortName: "TA" },
      { id: UNI_B, name: `${P}Universitet B`, shortName: "TB" },
    ],
  });
  await db.district.createMany({
    data: [
      { id: DIST_A, name: `${P}Tuman A`, lat: 41.3, lng: 69.2 },
      { id: DIST_B, name: `${P}Tuman B`, lat: 41.2, lng: 69.1 },
    ],
  });
  await db.user.create({ data: { id: ADMIN, phone: "+998000000801", role: "ADMIN" } });
  await student(students.a1, "+998000000811", UNI_A, "APPROVED");
  await student(students.a2, "+998000000812", UNI_A, "APPROVED");
  await student(students.b1, "+998000000813", UNI_B, "APPROVED");
  await student(students.blocked, "+998000000814", UNI_A, "APPROVED", true);
  await student(students.pending, "+998000000815", UNI_A, "PENDING");

  await db.user.create({ data: { id: OWNER, phone: "+998000000821", role: "BUSINESS_OWNER" } });
  await db.user.create({ data: { id: OWNER_PENDING, phone: "+998000000822", role: "BUSINESS_OWNER" } });
  await db.business.create({ data: { id: BIZ, ownerId: OWNER, name: `${P}biznes`, kind: "CAFE", address: "test", workingHours: "09:00–18:00", status: "APPROVED", submittedAt: now, districtId: DIST_A } });
  await db.business.create({ data: { id: `${BIZ}_pending`, ownerId: OWNER_PENDING, name: `${P}kutayotgan`, kind: "CAFE", address: "test", workingHours: "09:00–18:00", status: "PENDING", submittedAt: now } });
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

const form = (extra: Record<string, unknown> = {}) => ({ audience: "ALL_STUDENTS", title: "Sarlavha", body: "Matn", linkType: "HOME", when: "now", ...extra });
const mine = (ids: string[]) => ids.filter((id) => id.startsWith(P));

describe("auditoriya", () => {
  it("barcha talabalar: faqat tasdiqlangan va bloklanmagan", async () => {
    const ids = mine(await audienceUserIds("ALL_STUDENTS", [], now));
    expect(ids.sort()).toEqual([students.a1, students.a2, students.b1].sort());
  });

  it("universitet bo'yicha: faqat tanlangan universitet(lar)", async () => {
    expect(mine(await audienceUserIds("UNIVERSITY", [UNI_A], now)).sort()).toEqual([students.a1, students.a2].sort());
    expect(mine(await audienceUserIds("UNIVERSITY", [UNI_A, UNI_B], now)).sort()).toEqual([students.a1, students.a2, students.b1].sort());
    expect(await audienceReach("UNIVERSITY", [UNI_B], now)).toBe(1);
  });

  it("bizneslar: faqat tasdiqlangan biznes egalari", async () => {
    const ids = mine(await audienceUserIds("BUSINESSES", [], now));
    expect(ids).toEqual([OWNER]);
  });

  it("hudud: shu tumandagi biznesdan oxirgi 90 kunda kupon olgan talabalar", async () => {
    const discount = await db.discount.create({
      data: {
        business: { connect: { id: BIZ } },
        category: { connectOrCreate: { where: { slug: "taom" }, create: { slug: "taom", name: "Taomlar", tileColor: "#F4DCCB", inkColor: "#8A3410", icon: "bowl" } } },
        title: "test",
        type: "PERCENT",
        percent: 10,
        status: "ACTIVE",
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        fromMinute: 0,
        toMinute: 1439,
        startsOn: new Date("2026-01-01"),
        endsOn: new Date("2027-01-01"),
        dailyLimit: 10,
      },
    });
    const coupon = (studentId: string, code: string, createdAt: Date) =>
      db.coupon.create({
        data: { code, discountId: discount.id, studentId, date: new Date("2026-10-01"), secret: Buffer.from("x"), expiresAt: createdAt, createdAt, termsTitle: "test", termsType: "PERCENT" },
      });
    await coupon(students.a1, `${P}c1`, new Date("2026-10-01T09:00:00Z"));
    // 90 kundan eski kupon hisobga olinmaydi
    await coupon(students.a2, `${P}c2`, new Date("2026-05-01T09:00:00Z"));

    expect(mine(await audienceUserIds("DISTRICT", [DIST_A], now))).toEqual([students.a1]);
    expect(mine(await audienceUserIds("DISTRICT", [DIST_B], now))).toEqual([]);
  });
});

describe("yaratish va yuborish", () => {
  it("noto'g'ri forma rad etiladi, hech narsa yaratilmaydi", async () => {
    expect(await createNotification(form({ title: "" }), ADMIN, now)).toEqual({ ok: false, error: "invalid" });
    expect(await createNotification(form({ audience: "UNIVERSITY" }), ADMIN, now)).toEqual({ ok: false, error: "audience_empty" });
    expect(await createNotification(form({ audience: "BUSINESSES", linkType: "CATEGORY", linkId: "kofe" }), ADMIN, now)).toEqual({ ok: false, error: "invalid" });
    expect(await createNotification(form({ when: "later", scheduledAt: "2026-10-15T14:01" }), ADMIN, now)).toEqual({ ok: false, error: "past" });
    expect(await db.notification.count({ where: { createdById: ADMIN } })).toBe(0);
  });

  it("'hozir': yuborilganda faqat auditoriyaga ilova ichi xabar tushadi, holat SENT, audit yoziladi", async () => {
    const created = await createNotification(form({ audience: "UNIVERSITY", audienceIds: [UNI_A] }), ADMIN, now);
    if (!created.ok) throw new Error("yaratilmadi");
    expect(created.immediate).toBe(true);

    expect(await dispatchNotification(created.id, now)).toBe("sent");
    const n = await db.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(n.status).toBe("SENT");
    expect(n.delivered).toBe(2);
    const recipients = await db.userNotification.findMany({ where: { notificationId: created.id }, select: { userId: true } });
    expect(recipients.map((r) => r.userId).sort()).toEqual([students.a1, students.a2].sort());
    expect(await db.auditLog.count({ where: { action: "notification.create", entityId: created.id, actorId: ADMIN } })).toBe(1);
  });

  it("parallel yuborish: xabar bir marta ketadi (atom claim)", async () => {
    const created = await createNotification(form(), ADMIN, now);
    if (!created.ok) throw new Error("yaratilmadi");
    const results = await Promise.all([dispatchNotification(created.id, now), dispatchNotification(created.id, now), dispatchNotification(created.id, now)]);
    expect(results.filter((r) => r === "sent")).toHaveLength(1);
    expect(results.filter((r) => r === "skipped")).toHaveLength(2);
    const rows = await db.userNotification.count({ where: { notificationId: created.id } });
    expect(rows).toBe((await db.notification.findUniqueOrThrow({ where: { id: created.id } })).delivered);
    // qayta chaqirish ham hech narsani ikkilantirmaydi
    expect(await dispatchNotification(created.id, now)).toBe("skipped");
    expect(await db.userNotification.count({ where: { notificationId: created.id } })).toBe(rows);
  });

  it("rejalashtirilgan: vaqti kelmaguncha yuborilmaydi, kelgach cron yuboradi", async () => {
    const created = await createNotification(form({ audience: "BUSINESSES", when: "later", scheduledAt: "2026-10-16T08:30" }), ADMIN, now);
    if (!created.ok) throw new Error("yaratilmadi");
    expect(created.immediate).toBe(false);

    // hali erta
    expect(await dispatchNotification(created.id, now)).toBe("skipped");
    await dispatchDue(now);
    expect((await db.notification.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("SCHEDULED");
    expect(await db.userNotification.count({ where: { notificationId: created.id } })).toBe(0);

    // ertasi kuni 08:30 Toshkent (03:30 UTC) dan keyin
    const later = new Date("2026-10-16T03:31:00Z");
    const done = await dispatchDue(later);
    expect(done.sent).toBeGreaterThanOrEqual(1);
    const n = await db.notification.findUniqueOrThrow({ where: { id: created.id } });
    expect(n.status).toBe("SENT");
    const recipients = await db.userNotification.findMany({ where: { notificationId: created.id, userId: { startsWith: P } } });
    expect(recipients.map((r) => r.userId)).toEqual([OWNER]);
    // takroriy cron — yana yubormaydi
    expect((await dispatchDue(later)).sent).toBe(0);
  });

  it("to'xtab qolgan (SENDING) xabar FAILED bo'ladi, yangi boshlanganiga tegilmaydi", async () => {
    const make = (sentAt: Date) =>
      db.notification.create({ data: { title: "t", body: "b", audience: "ALL_STUDENTS", scheduledAt: sentAt, sentAt, status: "SENDING", createdById: ADMIN } });
    const old = await make(new Date(now.getTime() - (STUCK_MINUTES + 1) * 60_000));
    const fresh = await make(new Date(now.getTime() - 60_000));
    const result = await dispatchDue(now);
    expect(result.stuck).toBeGreaterThanOrEqual(1);
    expect((await db.notification.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("FAILED");
    expect((await db.notification.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe("SENDING");
  });

  it("tarix: ochilish ulushi o'qilgan qatorlardan hisoblanadi, tizim xabarlari ko'rinmaydi", async () => {
    const created = await createNotification(form({ audience: "UNIVERSITY", audienceIds: [UNI_A] }), ADMIN, now);
    if (!created.ok) throw new Error("yaratilmadi");
    await dispatchNotification(created.id, now);
    await markInboxRead(students.a1);
    await notifyUser(students.a2, "studentApproved", {}, ADMIN);

    const history = await notificationHistory(50);
    const row = history.find((h) => h.id === created.id)!;
    expect(row).toMatchObject({ status: "SENT", delivered: 2, opened: 1, audienceNames: ["TA"] });
    expect(history.some((h) => h.audience === "USER")).toBe(false);
  });
});

describe("tizim xabari (tasdiq / rad)", () => {
  it("talabaga ilova ichi xabar tushadi; sabab matnga kiradi va 150 belgiga qisqartiriladi", async () => {
    await notifyUser(students.a1, "studentRejected", { reason: "Rasm xira, o'qib bo'lmaydi" }, ADMIN);
    const [item] = await inboxItems(students.a1, "/chegirmalar");
    expect(item).toMatchObject({ title: "Guvohnoma rad etildi", unread: true, href: "/chegirmalar" });
    expect(item!.body).toContain("Rasm xira");

    await notifyUser(students.a2, "studentRejected", { reason: "x".repeat(500) }, ADMIN);
    const [long] = await inboxItems(students.a2, "/chegirmalar");
    expect(long!.body.length).toBeLessThanOrEqual(150);
    expect(long!.body).toContain("…");
  });

  it("bloklangan foydalanuvchiga xabar yuborilmaydi", async () => {
    await notifyUser(students.blocked, "studentApproved", {}, ADMIN);
    expect(await db.userNotification.count({ where: { userId: students.blocked } })).toBe(0);
  });

  it("biznes egasi: tasdiq xabari; o'qilgach 'yangi' belgisi yo'qoladi", async () => {
    await notifyUser(OWNER, "businessApproved", {}, ADMIN);
    expect(await unreadCount(OWNER)).toBe(1);
    expect((await inboxItems(OWNER, "/biznes"))[0]).toMatchObject({ title: "Biznesingiz tasdiqlandi", href: "/biznes" });
    expect(await markInboxRead(OWNER)).toBe(1);
    expect(await unreadCount(OWNER)).toBe(0);
    // faqat o'zining xabarlari o'qiladi
    await notifyUser(students.a1, "studentApproved", {}, ADMIN);
    expect(await markInboxRead(OWNER)).toBe(0);
    expect(await unreadCount(students.a1)).toBe(1);
  });
});
