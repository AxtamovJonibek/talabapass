import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { setNotifyDeals, studentTotals, updateProfile } from "./profile";

// Faqat shu test yaratadigan yozuvlar ("itest_" prefiksi)
const USER = "itest_prof_student";
const UNI = "itest_prof_uni";
const DISTRICT = "itest_prof_district";
const OTHER = "itest_prof_other";
const form = { firstName: "Dilnoza", lastName: "Karimova", course: "C3" as const, faculty: "Dasturiy injiniring", districtId: null as string | null };

async function cleanup() {
  await db.studentProfile.deleteMany({ where: { userId: { in: [USER, OTHER] } } });
  await db.user.deleteMany({ where: { id: { in: [USER, OTHER] } } });
  await db.university.deleteMany({ where: { id: UNI } });
  await db.district.deleteMany({ where: { id: DISTRICT } });
}

beforeEach(async () => {
  await cleanup();
  await db.university.create({ data: { id: UNI, name: "itest profil universiteti", shortName: "IP" } });
  await db.district.create({ data: { id: DISTRICT, name: "itest profil tumani", lat: 41.3, lng: 69.2 } });
  for (const [id, phone] of [[USER, "+998000000901"], [OTHER, "+998000000902"]] as const) {
    await db.user.create({
      data: { id, phone, role: "STUDENT", firstName: "Eski", lastName: "Ism", student: { create: { universityId: UNI, course: "C1", publicId: `TP-ITEST-${id.slice(-5)}`, status: "APPROVED" } } },
    });
  }
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("profilni tahrirlash", () => {
  it("ism, kurs, fakultet va tumanni saqlaydi; universitet o'zgarmaydi", async () => {
    expect(await updateProfile(USER, { ...form, districtId: DISTRICT })).toEqual({ ok: true });
    const u = await db.user.findUniqueOrThrow({ where: { id: USER }, include: { student: true } });
    expect(u).toMatchObject({ firstName: "Dilnoza", lastName: "Karimova" });
    expect(u.student).toMatchObject({ course: "C3", faculty: "Dasturiy injiniring", districtId: DISTRICT, universityId: UNI, status: "APPROVED" });
  });

  it("tumanni bo'sh qoldirish yoki o'chirish mumkin; yo'q tuman rad etiladi va hech narsa o'zgarmaydi", async () => {
    await updateProfile(USER, { ...form, districtId: DISTRICT });
    expect(await updateProfile(USER, { ...form, districtId: null })).toEqual({ ok: true });
    expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: USER } })).districtId).toBeNull();

    expect(await updateProfile(USER, { ...form, firstName: "Yangi", districtId: "itest_yoq" })).toEqual({ ok: false, field: "districtId" });
    expect((await db.user.findUniqueOrThrow({ where: { id: USER } })).firstName).toBe("Dilnoza");
  });

  it("boshqa talabaning ma'lumotiga tegmaydi", async () => {
    await updateProfile(USER, { ...form, districtId: DISTRICT });
    const other = await db.user.findUniqueOrThrow({ where: { id: OTHER }, include: { student: true } });
    expect(other.firstName).toBe("Eski");
    expect(other.student?.districtId).toBeNull();
  });

  it("tuman o'chirilsa talabaning tumani bo'shaydi (talaba o'chmaydi)", async () => {
    await updateProfile(USER, { ...form, districtId: DISTRICT });
    await db.district.delete({ where: { id: DISTRICT } });
    expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: USER } })).districtId).toBeNull();
  });
});

describe("bildirishnoma kaliti va jami", () => {
  it("yangi chegirmalar xabari yoqiladi/o'chiriladi", async () => {
    await setNotifyDeals(USER, false);
    expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: USER } })).notifyDeals).toBe(false);
    await setNotifyDeals(USER, true);
    expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: USER } })).notifyDeals).toBe(true);
  });

  it("xaridsiz talabada jami nol", async () => {
    expect(await studentTotals(USER)).toEqual({ totalSaved: 0, totalCount: 0, places: 0 });
  });
});
