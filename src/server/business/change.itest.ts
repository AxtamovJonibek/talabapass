import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
import { addContactNote, businessChanges, businessList, contactNotes } from "../admin/business-card";
import { approveBusiness, blockBusinessFromReview, reopenBusiness } from "../admin/review";
import { db } from "../db";
import { changeBusiness } from "./change";
import { editBusinessInfo } from "./profile-edit";

// Faqat shu test yaratadigan yozuvlar ("itest_" prefiksi)
const OWNER = "itest_chg_owner";
const ADMIN = "itest_chg_admin";
const BIZ = "itest_chg_biz";
const admin = { id: ADMIN, role: "ADMIN" as const };
const owner = { id: OWNER, role: "OWNER" as const };
const base = { name: "Itest Kafe", address: "Toshkent, Itest 1", workingHours: "Har kuni · 09:00–21:00", description: "" };

async function cleanup() {
  await db.auditLog.deleteMany({ where: { entityId: BIZ } });
  await db.business.deleteMany({ where: { id: BIZ } });
  await db.user.deleteMany({ where: { id: { in: [OWNER, ADMIN] } } });
}

const setup = async (data: Record<string, unknown> = {}) => {
  await cleanup();
  await db.user.createMany({ data: [{ id: OWNER, phone: "+998000000931", role: "BUSINESS_OWNER" }, { id: ADMIN, phone: "+998000000932", role: "ADMIN", firstName: "Itest", lastName: "Admin" }] });
  await db.business.create({ data: { id: BIZ, ownerId: OWNER, kind: "CAFE", status: "PENDING", submittedAt: new Date(), tin: "930000001", lat: 41.3, lng: 69.2, ...base, ...data } });
};
const load = () => db.business.findUniqueOrThrow({ where: { id: BIZ } });

beforeEach(() => setup());
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("changeBusiness — maydon ruxsatlari", () => {
  it("ega STIR, kategoriya, joylashuv va holatni o'zgartira olmaydi — hech narsa yozilmaydi", async () => {
    const result = await changeBusiness({ actor: owner, businessId: BIZ, changes: { name: "Yangi nom", tin: "930000002", lat: 1 } });
    expect(result).toMatchObject({ ok: false, error: "forbidden", fields: ["tin", "lat"] });
    expect(await load()).toMatchObject({ name: base.name, tin: "930000001", lat: 41.3 });
    expect(await businessChanges(BIZ)).toHaveLength(0);
  });

  it("admin hamma maydonni o'zgartiradi; jurnalda kim, oldin → keyin yoziladi", async () => {
    const result = await changeBusiness({ actor: admin, businessId: BIZ, changes: { name: "Admin nomi", tin: "930000002", kind: "SHOP", lat: 41.5, telegram: "kafe" } });
    expect(result).toMatchObject({ ok: true, rereview: false });
    expect(await load()).toMatchObject({ name: "Admin nomi", tin: "930000002", kind: "SHOP", lat: 41.5, telegram: "kafe", status: "PENDING" });
    const log = await businessChanges(BIZ);
    expect(log).toHaveLength(5);
    expect(log.find((c) => c.field === "name")).toMatchObject({ role: "ADMIN", actor: "Itest Admin", oldValue: base.name, newValue: "Admin nomi" });
    expect(log.find((c) => c.field === "lat")).toMatchObject({ oldValue: "41.3", newValue: "41.5" });
    expect(await db.auditLog.count({ where: { entityId: BIZ, action: "business.edit.admin" } })).toBe(1);
  });

  it("o'zgarish bo'lmasa jurnal ham, audit ham yozilmaydi", async () => {
    expect(await changeBusiness({ actor: admin, businessId: BIZ, changes: { name: base.name, description: null } })).toMatchObject({ ok: true, changed: [] });
    expect(await businessChanges(BIZ)).toHaveLength(0);
  });

  it("STIR band bo'lsa — tinInUse, hech narsa o'zgarmaydi", async () => {
    await db.business.create({ data: { id: `${BIZ}_2`, ownerId: ADMIN, kind: "CAFE", tin: "930000009", ...base } });
    try {
      expect(await changeBusiness({ actor: admin, businessId: BIZ, changes: { name: "X nomi", tin: "930000009" } })).toMatchObject({ ok: false, error: "tinInUse" });
      expect((await load()).name).toBe(base.name);
    } finally {
      await db.business.delete({ where: { id: `${BIZ}_2` } });
    }
  });
});

describe("ega profili umumiy funksiyadan o'tadi", () => {
  it("editBusinessInfo jurnalga yozadi; nom o'zgarsa tasdiqlangan biznes qayta tekshiruvga tushadi", async () => {
    await setup({ status: "APPROVED" });
    expect(await editBusinessInfo(OWNER, { ...base, name: "Egasi nomi" })).toEqual({ ok: true, rereview: true });
    const log = await businessChanges(BIZ);
    expect(log.map((c) => [c.role, c.field, c.newValue]).sort()).toEqual([["OWNER", "name", "Egasi nomi"], ["OWNER", "status", "PENDING"]].sort());
  });

  it("admin cheklagan bo'lsa (ruxsat yo'q) — noPermission", async () => {
    await db.businessPermissions.create({ data: { businessId: BIZ, canEditProfile: false } });
    expect(await editBusinessInfo(OWNER, { ...base, workingHours: "Har kuni · 10:00–20:00" })).toEqual({ ok: false, error: "noPermission" });
    await db.businessPermissions.delete({ where: { businessId: BIZ } });
  });
});

describe("holat: tasdiqlash, rad etish, bloklash, qayta ochish", () => {
  it("tasdiqlashdan oldin kategoriya, ish vaqti, joylashuv to'liq bo'lishi shart", async () => {
    await setup({ workingHours: "", lat: null, lng: null });
    expect(await approveBusiness(BIZ, ADMIN)).toEqual({ ok: false, error: "incomplete", missing: ["workingHours", "location"] });
    expect((await load()).status).toBe("PENDING");
    await changeBusiness({ actor: admin, businessId: BIZ, changes: { workingHours: "Har kuni · 09:00–21:00", lat: 41.3, lng: 69.2 } });
    expect(await approveBusiness(BIZ, ADMIN)).toEqual({ ok: true });
    expect((await load()).status).toBe("APPROVED");
    expect((await businessChanges(BIZ)).find((c) => c.field === "status")).toMatchObject({ role: "ADMIN", oldValue: "PENDING", newValue: "APPROVED" });
  });

  it("bloklash va qayta ochish; rad etilgan qayta navbatga tushadi", async () => {
    await setup({ status: "APPROVED" });
    await db.business.update({ where: { id: BIZ }, data: { status: "REJECTED" } });
    expect(await reopenBusiness(BIZ, ADMIN)).toEqual({ ok: true });
    expect((await load()).status).toBe("PENDING");
    expect(await reopenBusiness(BIZ, ADMIN)).toMatchObject({ ok: false });
    expect(await blockBusinessFromReview({ businessId: BIZ, reasonKey: "fake", reasonText: "Soxta" }, ADMIN)).toEqual({ ok: true });
    expect((await load()).status).toBe("BLOCKED");
    expect(await reopenBusiness(BIZ, ADMIN)).toEqual({ ok: true });
    expect((await load()).status).toBe("PENDING");
    expect((await businessChanges(BIZ)).filter((c) => c.field === "status").length).toBe(3);
  });
});

describe("aloqa qaydlari va ro'yxat", () => {
  it("qayd: belgi, sana, izoh saqlanadi; belgisiz va izohsiz — rad", async () => {
    expect(await addContactNote(ADMIN, { businessId: BIZ, contacted: true, contactedAt: "2026-11-18", note: "Telefon qildim" })).toEqual({ ok: true });
    expect(await addContactNote(ADMIN, { businessId: BIZ, contacted: false, contactedAt: "2026-11-18", note: "" })).toEqual({ ok: false, error: "empty" });
    expect(await addContactNote(ADMIN, { businessId: BIZ, contacted: true, contactedAt: "18.11.2026", note: "" })).toEqual({ ok: false, error: "invalid" });
    expect(await addContactNote(ADMIN, { businessId: "yoq", contacted: true, contactedAt: "2026-11-18", note: "" })).toEqual({ ok: false, error: "notFound" });
    const notes = await contactNotes(BIZ);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ contacted: true, note: "Telefon qildim", admin: "Itest Admin" });
    expect(notes[0]!.contactedAt.toISOString().slice(0, 10)).toBe("2026-11-18");
  });

  it("qidiruv nom, STIR va telefon bo'yicha; holat filtri", async () => {
    await db.business.update({ where: { id: BIZ }, data: { contactPhone: "+998901230931" } });
    const ids = async (input: Parameters<typeof businessList>[0]) => (await businessList(input)).items.map((b) => b.id);
    expect(await ids({ q: "itest kafe" })).toContain(BIZ);
    expect(await ids({ q: "930000001" })).toContain(BIZ);
    expect(await ids({ q: "+998 90 123 0931" })).toContain(BIZ);
    expect(await ids({ q: "itest kafe", status: "pending" })).toContain(BIZ);
    expect(await ids({ q: "itest kafe", status: "blocked" })).not.toContain(BIZ);
  });
});
