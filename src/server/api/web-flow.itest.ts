import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hashOtp } from "../auth/otp-rules";
import { hashPassword } from "../auth/password";
import { db } from "../db";
import { authSecret } from "../env";
import { loginWith, setPasswordWith, signInWith, verifyCode } from "./auth-flow";
import { ApiError } from "./http";
import { registerBusinessWith, registerStudentWith } from "./register";

/*
 * Sayt oqimi (`actions/web-auth.ts`) ilova bilan bir xil qoidalarni ishlatadi, faqat sessiya ochuvchi boshqa (`Opener`).
 * Bu yerda — ochuvchi chaqiriladi, API tokenlari ochilmaydi, qoidalar (parol, qadam tokeni, ro'yxat) o'zgarmagan.
 */

const NEW_PHONE = "+998000000341";
const OLD_PHONE = "+998000000342";
const BIZ_PHONE = "+998000000343";
const PHONES = [NEW_PHONE, OLD_PHONE, BIZ_PHONE];
const PASSWORD = "parol1234";
const CODE = "482913";
const TIN = "309000341";

const opener = async (userId: string) => userId;

async function cleanup() {
  await db.business.deleteMany({ where: { tin: TIN } });
  const users = await db.user.findMany({ where: { phone: { in: PHONES } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.otpCode.deleteMany({ where: { phone: { in: PHONES } } });
}

async function verified(phone: string, intent: "student" | "business" = "student") {
  await db.otpCode.create({ data: { phone, codeHash: hashOtp(phone, CODE, authSecret()), expiresAt: new Date(Date.now() + 5 * 60_000) } });
  return verifyCode(phone, CODE, intent);
}

const code = (error: unknown) => (error instanceof ApiError ? error.code : error);

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("sayt oqimi: umumiy qoidalar, boshqa sessiya ochuvchi", () => {
  it("yangi talaba: kod → parol → ro'yxat tokeni → hisob ochuvchi orqali (API sessiyasi ochilmaydi)", async () => {
    const v = await verified(NEW_PHONE);
    expect(v).toMatchObject({ next: "setPassword", isNew: true, role: "student" });
    if (v.next !== "setPassword") throw new Error("kutilmagan qadam");

    await expect(setPasswordWith(v.ticket, "qisqa", "qisqa", opener)).rejects.toMatchObject({ code: "weak_password" });
    await expect(setPasswordWith(v.ticket, PASSWORD, "boshqa1234", opener)).rejects.toMatchObject({ code: "password_mismatch" });
    const set = await setPasswordWith(v.ticket, PASSWORD, PASSWORD, opener);
    if (set.next !== "register") throw new Error("kutilmagan qadam");
    expect(await db.user.findUnique({ where: { phone: NEW_PHONE } }), "hisob hali ochilmaydi").toBeNull();

    const university = await db.university.findFirstOrThrow({ where: { active: true, kind: { not: "OTHER" } }, select: { id: true } });
    const userId = await registerStudentWith({ registrationTicket: set.registrationTicket, firstName: "Sayt", lastName: "Sinov", universityId: university.id, course: "C2" }, opener);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, passwordHash: true, role: true } });
    expect(user).toMatchObject({ phone: NEW_PHONE, role: "STUDENT" });
    expect(user.passwordHash).not.toBeNull();
    expect(await db.session.count({ where: { userId } }), "ochuvchi sessiya yozmagan").toBe(0);

    // Xuddi shu ticket bilan ikkinchi marta ro'yxat — hisob band
    await expect(registerStudentWith({ registrationTicket: set.registrationTicket, firstName: "Sayt", lastName: "Sinov", universityId: university.id, course: "C2" }, opener).catch((e) => Promise.reject(code(e)))).rejects.toBe("step_expired");
  });

  it("biznes arizasi: noto'g'ri STIR — maydonlar, to'g'risi — egasi hisobi", async () => {
    const v = await verified(BIZ_PHONE, "business");
    if (v.next !== "setPassword") throw new Error("kutilmagan qadam");
    const set = await setPasswordWith(v.ticket, PASSWORD, PASSWORD, opener);
    if (set.next !== "register") throw new Error("kutilmagan qadam");

    const input = { name: "Sinov Kafesi", address: "Toshkent, Chilonzor 9", tin: "123", phone: BIZ_PHONE, telegram: "@sinovkafe" };
    await expect(registerBusinessWith(set.registrationTicket, input, opener)).rejects.toMatchObject({ code: "invalid_request", details: { fields: ["tin"] } });
    expect(await db.user.findUnique({ where: { phone: BIZ_PHONE } })).toBeNull();

    const userId = await registerBusinessWith(set.registrationTicket, { ...input, tin: TIN }, opener);
    const business = await db.business.findFirstOrThrow({ where: { ownerId: userId }, select: { status: true, submittedAt: true, tin: true, telegram: true } });
    expect(business).toMatchObject({ status: "PENDING", submittedAt: null, tin: TIN });
  });

  it("mavjud hisob: parol bilan kirish (telefon) — noto'g'ri parol rad, to'g'risi ochuvchini chaqiradi; parolsiz hisob — wrong_password", async () => {
    await db.user.create({ data: { phone: OLD_PHONE, role: "STUDENT", firstName: "Sayt", passwordHash: hashPassword(PASSWORD) } });
    await expect(signInWith(OLD_PHONE, "noto'g'ri1", opener)).rejects.toMatchObject({ code: "wrong_password", details: { left: 4 } });
    await expect(signInWith(OLD_PHONE, PASSWORD, opener)).resolves.toBe((await db.user.findUniqueOrThrow({ where: { phone: OLD_PHONE } })).id);

    await db.user.update({ where: { phone: OLD_PHONE }, data: { passwordHash: null } });
    await expect(signInWith(OLD_PHONE, PASSWORD, opener).catch((e) => Promise.reject(code(e)))).rejects.toBe("wrong_password");
  });

  it("SMS tasdig'idan keyin parol bilan kirish (qadam tokeni) va 'Parolni unutdim' — boshqa sessiyalar yopiladi", async () => {
    const user = await db.user.create({ data: { phone: OLD_PHONE, role: "STUDENT", firstName: "Sayt", passwordHash: hashPassword(PASSWORD) } });
    await db.session.create({ data: { userId: user.id, tokenHash: "web-flow-old", expiresAt: new Date(Date.now() + 60_000) } });

    const v = await verified(OLD_PHONE);
    if (v.next !== "password") throw new Error("kutilmagan qadam");
    await expect(loginWith(v.ticket, "noto'g'ri1", opener)).rejects.toMatchObject({ code: "wrong_password" });
    await expect(loginWith(v.ticket, PASSWORD, opener)).resolves.toBe(user.id);

    const reset = await setPasswordWith(v.ticket, "yangi1234", "yangi1234", opener);
    expect(reset).toEqual({ next: "signedIn", opened: user.id });
    expect(await db.session.count({ where: { userId: user.id } }), "eski sessiya yopilgan").toBe(0);
    await expect(signInWith(OLD_PHONE, "yangi1234", opener)).resolves.toBe(user.id);
  });
});
