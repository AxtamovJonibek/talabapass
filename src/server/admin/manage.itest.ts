import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { createAdmin, deleteUniversity, editBusiness, editUser, rejectUniversityRequest, resolveUniversityRequest, saveUniversity, updateOwnName } from "./manage";

// Faqat shu test yaratadigan yozuvlar ("itest_mng_" prefiksi)
const P = "itest_mng_";
const ID = { admin: `${P}admin`, student: `${P}student`, other: `${P}other`, owner: `${P}owner` };
const BIZ = `${P}biz`;
const UNI = `${P}uni`;
const PHONE = { admin: "+998000001001", student: "+998000001002", other: "+998000001003", owner: "+998000001004", newAdmin: "+998000001005" };

async function cleanup() {
  const users = [...Object.values(ID)];
  const created = await db.user.findMany({ where: { phone: PHONE.newAdmin }, select: { id: true } });
  const ids = [...users, ...created.map((u) => u.id)];
  await db.universityRequest.deleteMany({ where: { userId: { in: ids } } });
  await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: [...ids, BIZ] } }] } });
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.business.deleteMany({ where: { id: BIZ } });
  await db.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.university.deleteMany({ where: { OR: [{ id: UNI }, { name: { startsWith: `${P}` } }] } });
}

let other: { id: string };
let uni: { id: string };

async function setup() {
  await cleanup();
  other = (await db.university.findFirst({ where: { kind: "OTHER" } })) ?? (await db.university.create({ data: { name: "Boshqa (ro'yxatda yo'q)", shortName: "Boshqa", region: "—", kind: "OTHER", active: false } }));
  uni = await db.university.create({ data: { id: UNI, name: `${P}Universitet`, shortName: "ITEST", region: "Toshkent shahri", kind: "STATE", source: "admin" } });
  await db.user.createMany({
    data: [
      { id: ID.admin, phone: PHONE.admin, role: "ADMIN", firstName: "Admin", lastName: "Test" },
      { id: ID.student, phone: PHONE.student, role: "STUDENT", firstName: "Ali", lastName: "Valiyev" },
      { id: ID.other, phone: PHONE.other, role: "STUDENT", firstName: "Vali", lastName: "Aliyev" },
      { id: ID.owner, phone: PHONE.owner, role: "BUSINESS_OWNER", firstName: "Egasi", lastName: "Biznes" },
    ],
  });
  await db.studentProfile.create({ data: { userId: ID.student, universityId: other.id, course: "C1", publicId: `TP-${P}1` } });
  await db.studentProfile.create({ data: { userId: ID.other, universityId: uni.id, course: "C2", publicId: `TP-${P}2`, cardNumber: `${P}card` } });
  await db.business.create({ data: { id: BIZ, ownerId: ID.owner, name: "Itest Biznes", kind: "CAFE", address: "Toshkent, Chilonzor 5", workingHours: "09:00 – 23:00", status: "APPROVED", submittedAt: new Date() } });
}

const logs = (action: string, entityId: string) => db.auditLog.findMany({ where: { action, entityId } });
const studentForm = { firstName: "Ali", lastName: "Valiyev", phone: PHONE.student, course: "C3", faculty: "Fizika", universityId: UNI, districtId: "", cardNumber: "", cardExpiresAt: "" };

beforeEach(setup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("admin boshqaruvi", () => {
  it("o'z ismini o'zgartiradi (audit: oldin → keyin); noto'g'ri ism rad etiladi", async () => {
    expect(await updateOwnName(ID.admin, { firstName: "Dilnoza", lastName: "Karimova" })).toEqual({ ok: true });
    expect(await db.user.findUniqueOrThrow({ where: { id: ID.admin } })).toMatchObject({ firstName: "Dilnoza", lastName: "Karimova" });
    expect((await logs("admin.profile.update", ID.admin))[0]?.meta).toMatchObject({ changed: { firstName: ["Admin", "Dilnoza"] } });
    expect(await updateOwnName(ID.admin, { firstName: "1", lastName: "" })).toMatchObject({ ok: false, fields: ["firstName", "lastName"] });
  });

  it("yangi admin qo'shadi; band raqam (boshqa rol) rad etiladi", async () => {
    const created = await createAdmin(ID.admin, { firstName: "Yangi", lastName: "Admin", phone: "+998000001005" });
    expect(created).toMatchObject({ ok: true });
    const id = (created as { id: string }).id;
    expect(await db.user.findUniqueOrThrow({ where: { id } })).toMatchObject({ role: "ADMIN", phone: PHONE.newAdmin });
    expect(await logs("admin.create", id)).toHaveLength(1);
    expect(await createAdmin(ID.admin, { firstName: "Yana", lastName: "Admin", phone: PHONE.student })).toMatchObject({ ok: false, error: "phoneInUse" });
    expect(await createAdmin(ID.admin, { firstName: "Yana", lastName: "Admin", phone: "123" })).toMatchObject({ ok: false, fields: ["phone"] });
  });

  it("talaba tahriri: maydonlar o'zgaradi, telefon o'zgarsa sessiyalar yopiladi, audit yoziladi", async () => {
    await db.session.create({ data: { userId: ID.student, tokenHash: `${P}tok`, expiresAt: new Date(Date.now() + 86_400_000) } });
    expect(await editUser(ID.admin, ID.student, { ...studentForm, firstName: "Alisher", phone: "+998000001099", cardNumber: `${P}new`, cardExpiresAt: "2027-09-01" })).toEqual({ ok: true });
    const user = await db.user.findUniqueOrThrow({ where: { id: ID.student }, include: { student: true } });
    expect(user).toMatchObject({ firstName: "Alisher", phone: "+998000001099" });
    expect(user.student).toMatchObject({ course: "C3", faculty: "Fizika", universityId: UNI, cardNumber: `${P}new` });
    expect(user.student?.cardExpiresAt?.toISOString().slice(0, 10)).toBe("2027-09-01");
    expect(await db.session.count({ where: { userId: ID.student } })).toBe(0);
    const meta = (await logs("user.edit", ID.student))[0]?.meta as { changed: Record<string, unknown> };
    expect(meta.changed).toMatchObject({ firstName: ["Ali", "Alisher"], phone: [PHONE.student, "+998000001099"], course: ["C1", "C3"] });
    await db.user.update({ where: { id: ID.student }, data: { phone: PHONE.student } });
  });

  it("telefon yoki guvohnoma raqami band bo'lsa — xato; adminni tahrirlab bo'lmaydi", async () => {
    expect(await editUser(ID.admin, ID.student, { ...studentForm, phone: PHONE.other })).toMatchObject({ ok: false, error: "phoneInUse" });
    expect(await editUser(ID.admin, ID.student, { ...studentForm, cardNumber: `${P}card` })).toMatchObject({ ok: false, error: "cardInUse" });
    expect(await editUser(ID.admin, ID.student, { ...studentForm, universityId: "yoq" })).toMatchObject({ ok: false, fields: ["universityId"] });
    expect(await editUser(ID.admin, ID.admin, { firstName: "X", lastName: "Y", phone: PHONE.admin })).toMatchObject({ ok: false, error: "protected" });
    expect(await db.user.findUniqueOrThrow({ where: { id: ID.student } })).toMatchObject({ phone: PHONE.student });
  });

  it("biznes tahriri: aloqa, STIR; holat o'zgarmaydi; STIR bandligi", async () => {
    const form = { name: "Itest Biznes", legalName: "", tin: "999 888 777", kind: "CAFE", typeLabel: "Choyxona", address: "Toshkent, Chilonzor 5", landmark: "", workingHours: "08:00 – 22:00", description: "", contactName: "Egasi", contactPhone: "", publicPhone: "90 111 22 33", telegram: "@itest_biz", instagram: "" };
    expect(await editBusiness(ID.admin, BIZ, form)).toEqual({ ok: true });
    expect(await db.business.findUniqueOrThrow({ where: { id: BIZ } })).toMatchObject({ status: "APPROVED", tin: "999888777", publicPhone: "+998901112233", telegram: "itest_biz", workingHours: "08:00 – 22:00" });
    expect(await logs("business.edit.admin", BIZ)).toHaveLength(1);
    expect(await editBusiness(ID.admin, BIZ, { ...form, tin: "12" })).toMatchObject({ ok: false, fields: ["tin"] });
    expect(await editBusiness(ID.admin, "yoq", form)).toMatchObject({ ok: false, error: "notFound" });
  });

  it("universitet: qo'shish, tahrirlash, takror nom, talabali o'chirilmaydi, talabasizi o'chiriladi", async () => {
    const created = await saveUniversity(ID.admin, null, { name: `${P}Yangi OTM`, shortName: "YO", region: "Samarqand viloyati", kind: "PRIVATE", active: true });
    expect(created).toMatchObject({ ok: true });
    const id = (created as { id: string }).id;
    expect(await saveUniversity(ID.admin, null, { name: `${P.toUpperCase()}yangi otm`, shortName: "YO", region: "Samarqand viloyati", kind: "PRIVATE", active: true })).toMatchObject({ ok: false, error: "nameInUse" });
    expect(await saveUniversity(ID.admin, id, { name: `${P}Yangi OTM`, shortName: "YO2", region: "Samarqand viloyati", kind: "FOREIGN", active: false })).toEqual({ ok: true, id });
    expect(await db.university.findUniqueOrThrow({ where: { id } })).toMatchObject({ shortName: "YO2", kind: "FOREIGN", active: false, source: "admin" });
    expect(await deleteUniversity(ID.admin, UNI)).toMatchObject({ ok: false, error: "hasStudents" });
    expect(await deleteUniversity(ID.admin, id)).toEqual({ ok: true });
    expect(await db.university.count({ where: { id } })).toBe(0);
    expect(await deleteUniversity(ID.admin, other.id)).toMatchObject({ ok: false, error: "protected" });
    expect((await db.auditLog.findMany({ where: { actorId: ID.admin, action: { startsWith: "university." } } })).map((l) => l.action).sort()).toEqual(["university.create", "university.delete", "university.update"]);
  });

  it("'Ro'yxatda yo'q' so'rovi: yangi OTM sifatida qo'shiladi, bir xil nomli so'rovlar va talabalar biriktiriladi; rad etish", async () => {
    await db.universityRequest.createMany({
      data: [
        { id: `${P}r1`, userId: ID.student, name: `${P}Xayoliy Institut` },
        { id: `${P}r2`, userId: ID.other, name: ` ${P.toUpperCase()}xayoliy   institut ` },
      ],
    });
    await db.studentProfile.update({ where: { userId: ID.other }, data: { universityId: other.id } });
    const result = await resolveUniversityRequest(ID.admin, `${P}r1`, { create: { name: `${P}Xayoliy Institut`, shortName: "XI", region: "Toshkent shahri", kind: "PRIVATE", active: true } });
    expect(result).toMatchObject({ ok: true });
    const universityId = (result as { id: string }).id;
    for (const userId of [ID.student, ID.other]) expect((await db.studentProfile.findUniqueOrThrow({ where: { userId } })).universityId).toBe(universityId);
    expect((await db.universityRequest.findMany({ where: { id: { in: [`${P}r1`, `${P}r2`] } } })).every((r) => r.status === "RESOLVED" && r.universityId === universityId)).toBe(true);
    expect(await resolveUniversityRequest(ID.admin, `${P}r1`, { universityId })).toMatchObject({ ok: false, error: "notFound" });

    await db.universityRequest.create({ data: { id: `${P}r3`, userId: ID.student, name: `${P}Boshqa nom` } });
    expect(await rejectUniversityRequest(ID.admin, `${P}r3`)).toEqual({ ok: true });
    expect(await rejectUniversityRequest(ID.admin, `${P}r3`)).toMatchObject({ ok: false });
    await db.studentProfile.update({ where: { userId: ID.student }, data: { universityId: UNI } });
    await db.universityRequest.deleteMany({ where: { id: { startsWith: P } } });
    await db.university.update({ where: { id: universityId }, data: { name: `${P}del` } });
  });
});
