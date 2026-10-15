import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { editBusinessInfo } from "./profile-edit";

// Faqat shu test yaratadigan yozuvlar ("itest_" prefiksi)
const OWNER = "itest_edit_owner";
const OTHER = "itest_edit_other";
const BIZ = "itest_edit_biz";
const DISTRICT = "itest_edit_district";
const info = { name: "Choyxona Bahor", address: "Toshkent, Chilonzor 5", workingHours: "09:00 – 23:00", description: "Mazali osh" };

async function cleanup() {
  await db.auditLog.deleteMany({ where: { entityId: BIZ } });
  await db.business.deleteMany({ where: { id: BIZ } });
  await db.user.deleteMany({ where: { id: { in: [OWNER, OTHER] } } });
  await db.district.deleteMany({ where: { id: DISTRICT } });
}

const setup = async (status: "APPROVED" | "PENDING" | "REJECTED" | "BLOCKED" = "APPROVED", submitted = true) => {
  await cleanup();
  await db.district.create({ data: { id: DISTRICT, name: "Itestedit", lat: 41.3, lng: 69.2 } });
  await db.user.createMany({ data: [{ id: OWNER, phone: "+998000000911", role: "BUSINESS_OWNER" }, { id: OTHER, phone: "+998000000912", role: "BUSINESS_OWNER" }] });
  await db.business.create({ data: { id: BIZ, ownerId: OWNER, kind: "CAFE", status, submittedAt: submitted ? new Date() : null, ...info } });
};
const load = () => db.business.findUniqueOrThrow({ where: { id: BIZ } });
const auditOf = () => db.auditLog.findMany({ where: { entityId: BIZ, action: "business.edit" } });

beforeEach(() => setup());
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("biznes ma'lumotlarini tahrirlash", () => {
  it("ish vaqti va tavsif — tekshiruvsiz, holat o'zgarmaydi", async () => {
    expect(await editBusinessInfo(OWNER, { ...info, workingHours: "08:00 – 22:00", description: "" })).toEqual({ ok: true, rereview: false });
    const b = await load();
    expect(b).toMatchObject({ status: "APPROVED", workingHours: "08:00 – 22:00", description: null });
    expect((await auditOf())[0]?.meta).toMatchObject({ rereview: false });
  });

  it("nom yoki manzil o'zgarsa — qayta tekshiruv (PENDING), tuman manzildan, audit yoziladi", async () => {
    expect(await editBusinessInfo(OWNER, { ...info, name: "Choyxona Yangi" })).toEqual({ ok: true, rereview: true });
    expect(await load()).toMatchObject({ status: "PENDING", name: "Choyxona Yangi" });

    await setup();
    expect(await editBusinessInfo(OWNER, { ...info, address: "Toshkent, Itestedit tumani, 7-uy" })).toEqual({ ok: true, rereview: true });
    expect(await load()).toMatchObject({ status: "PENDING", districtId: DISTRICT });
    expect(await auditOf()).toHaveLength(1);
  });

  it("o'zgarishsiz saqlash — hech narsa yozilmaydi", async () => {
    expect(await editBusinessInfo(OWNER, info)).toEqual({ ok: true, rereview: false });
    expect(await auditOf()).toHaveLength(0);
  });

  it("noto'g'ri qiymat rad etiladi va hech narsa o'zgarmaydi", async () => {
    expect(await editBusinessInfo(OWNER, { ...info, name: "A", description: "x".repeat(121) })).toEqual({ ok: false, fields: ["name", "description"] });
    expect(await load()).toMatchObject({ name: info.name, status: "APPROVED" });
  });

  it("begona egasi, yuborilmagan, rad etilgan va bloklangan biznesni tahrirlab bo'lmaydi", async () => {
    expect(await editBusinessInfo(OTHER, { ...info, workingHours: "01:00 – 02:00" })).toEqual({ ok: false, error: "notEditable" });
    for (const [status, submitted] of [["APPROVED", false], ["REJECTED", true], ["BLOCKED", true]] as const) {
      await setup(status, submitted);
      expect(await editBusinessInfo(OWNER, { ...info, workingHours: "01:00 – 02:00" })).toEqual({ ok: false, error: "notEditable" });
      expect((await load()).workingHours).toBe(info.workingHours);
    }
  });
});
