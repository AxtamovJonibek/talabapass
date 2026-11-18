import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DiscountDraft } from "@/lib/discount";
import { DEFAULT_SETTINGS } from "@/lib/preorder";
import { createInvite, invitePhone } from "../business/cashiers";
import { saveDiscount, todayInTashkent } from "../business/discounts";
import { editBusinessInfo } from "../business/profile-edit";
import { cleanBusinessInfo, createBusinessOwner } from "../business/registration";
import { db } from "../db";
import { landingDeals, landingPartners, landingStats, landingStatsSection } from "../landing";
import { savePreorderSettings } from "../preorder/settings";
import { addCustomPartner, saveLandingSettings, savePartner } from "./landing-admin";
import {
  changeRole,
  closeSessions,
  createUser,
  deleteDiscountByAdmin,
  journal,
  requirePasswordReset,
  saveDiscountByAdmin,
  setBusinessPermissions,
  setDiscountStatusByAdmin,
  setUserBlocked,
  userAccount,
} from "./super";

// Faqat shu test ishlatadigan raqamlar va STIR
const PHONES = ["+998935559890", "+998935559891", "+998935559892", "+998935559893", "+998935559894"];
const TINS = ["309109890"];
const EMAIL = "super-itest@talabapass.test";
const CUSTOM = "Super itest brend";
let admin: string;
let owner: string;
let businessId: string;

const today = todayInTashkent();
const DRAFT: DiscountDraft = {
  title: "Super itest chegirma",
  type: "PERCENT",
  originalPrice: 30000,
  percent: 20,
  newPrice: null,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  fromMinute: 600,
  toMinute: 1200,
  dailyLimit: 30,
  perStudentLimit: "DAILY",
  startsOn: today,
  endsOn: new Date(Date.parse(`${today}T00:00:00Z`) + 20 * 86_400_000).toISOString().slice(0, 10),
  terms: "",
};
const ALLOW_ALL = { canCreateDiscounts: true, autoApproveDiscounts: false, canPreorder: true, canAddCashiers: true, maxActiveDiscounts: null, canEditProfile: true, canEditContacts: true };
const NO_FILTER = { q: "", group: "", actor: "", entity: "", entityId: "", from: "", to: "", page: 1 };

async function cleanup() {
  await db.landingPartner.deleteMany({ where: { OR: [{ name: CUSTOM }, { business: { tin: { in: TINS } } }] } });
  await db.business.deleteMany({ where: { OR: [{ tin: { in: TINS } }, { owner: { phone: { in: PHONES } } }] } });
  await db.user.deleteMany({ where: { OR: [{ phone: { in: PHONES } }, { email: EMAIL }, { phone: { startsWith: "deleted:" }, firstName: "SuperItest" }] } });
}

let landingBefore: Awaited<ReturnType<typeof db.landingSettings.findUnique>>;
beforeAll(async () => {
  landingBefore = await db.landingSettings.findUnique({ where: { id: "landing" } });
});

beforeEach(async () => {
  await cleanup();
  admin = (await db.user.create({ data: { phone: PHONES[0]!, role: "ADMIN", firstName: "SuperItest", lastName: "Admin" } })).id;
  const info = cleanBusinessInfo({ name: "Super itest kafe", kind: "CAFE", address: "Bunyodkor 1, Chilonzor", workingHours: "09–22", description: "", tin: TINS[0]!, contactName: "Super Egasi" });
  if (!info.ok) throw new Error("info");
  const created = await createBusinessOwner(PHONES[1]!, info.info);
  if (!created.ok) throw new Error(created.error);
  owner = created.userId;
  const business = await db.business.update({ where: { id: (await db.business.findFirstOrThrow({ where: { ownerId: owner } })).id }, data: { submittedAt: new Date(), status: "APPROVED", reviewedAt: new Date() } });
  businessId = business.id;
});

afterAll(async () => {
  await cleanup();
  if (landingBefore) await db.landingSettings.upsert({ where: { id: "landing" }, create: landingBefore, update: landingBefore });
  else await db.landingSettings.deleteMany({ where: { id: "landing" } });
  await db.$disconnect();
});

describe("biznes ruxsatlari panel va server tomonida", () => {
  it("saqlash: oldin → keyin auditda, o'zgarishsiz saqlash yozilmaydi", async () => {
    expect(await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, canAddCashiers: false, maxActiveDiscounts: 3 })).toEqual({ ok: true });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "business.permissions", entityId: businessId } });
    expect(log.actorId).toBe(admin);
    expect(log.meta).toEqual({ changed: { canAddCashiers: [true, false], maxActiveDiscounts: [null, 3] } });
    expect(await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, canAddCashiers: false, maxActiveDiscounts: 3 })).toEqual({ ok: true });
    expect(await db.auditLog.count({ where: { action: "business.permissions", entityId: businessId } })).toBe(1);
    expect(await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, maxActiveDiscounts: -1 })).toMatchObject({ ok: false, error: "invalid" });
  });

  it("kassir qo'shish o'chiq — havola ham, raqam bilan taklif ham yo'q", async () => {
    await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, canAddCashiers: false });
    expect(await createInvite(owner)).toEqual({ ok: false, error: "noPermission" });
    expect(await invitePhone(owner, PHONES[2]!)).toEqual({ ok: false, error: "noPermission" });
    expect(await db.cashierInvite.count({ where: { businessId } })).toBe(0);
  });

  it("chegirma yaratish o'chiq — egasi yangisini ocholmaydi", async () => {
    await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, canCreateDiscounts: false });
    expect(await saveDiscount(owner, null, DRAFT, "publish")).toEqual({ ok: false, error: "noPermission" });
  });

  it("profil va aloqa — alohida ruxsatlar", async () => {
    const base = { name: "Super itest kafe", address: "Bunyodkor 1, Chilonzor", workingHours: "09–22", description: "" };
    await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, canEditProfile: false });
    expect(await editBusinessInfo(owner, { ...base, workingHours: "10–22" })).toEqual({ ok: false, error: "noPermission" });
    expect(await editBusinessInfo(owner, { ...base, telegram: "@superitest" })).toMatchObject({ ok: true });
    await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, canEditContacts: false });
    expect(await editBusinessInfo(owner, { ...base, telegram: "@boshqa" })).toEqual({ ok: false, error: "noPermission" });
    expect(await editBusinessInfo(owner, { ...base, workingHours: "10–22" })).toMatchObject({ ok: true });
  });

  it("oldindan band qilish o'chiq — yoqib bo'lmaydi, o'chirish mumkin", async () => {
    await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, canPreorder: false });
    expect(await savePreorderSettings(owner, { ...DEFAULT_SETTINGS, enabled: true })).toEqual({ ok: false, error: "noPermission" });
    expect(await savePreorderSettings(owner, { ...DEFAULT_SETTINGS, enabled: false })).toEqual({ ok: true });
  });
});

describe("admin: foydalanuvchi hisobi", () => {
  it("hisob ma'lumoti parol xeshini qaytarmaydi; sessiyalar va kirishlar ko'rinadi", async () => {
    await db.user.update({ where: { id: owner }, data: { passwordHash: "scrypt:secret-hash", passwordSetAt: new Date() } });
    await db.session.create({ data: { userId: owner, tokenHash: "super-itest-1", expiresAt: new Date(Date.now() + 86_400_000), userAgent: "itest" } });
    await db.auditLog.create({ data: { actorId: owner, action: "user.login.ok", entity: "User", entityId: owner, meta: { method: "phone", via: "web" } } });
    const account = await userAccount(owner);
    expect(JSON.stringify(account)).not.toContain("secret-hash");
    expect(account).not.toHaveProperty("passwordHash");
    expect(account?.hasPassword).toBe(true);
    expect(account?.methods).toEqual(["password", "phone"]);
    expect(account?.sessions).toHaveLength(1);
    expect(account?.logins[0]).toMatchObject({ ok: true, method: "phone", via: "web" });
  });

  it("sessiyalarni yopish va parolni tiklash talabi", async () => {
    for (const i of [1, 2]) await db.session.create({ data: { userId: owner, tokenHash: `super-itest-${i}`, expiresAt: new Date(Date.now() + 86_400_000) } });
    const one = await db.session.findFirstOrThrow({ where: { userId: owner } });
    expect(await closeSessions(admin, owner, one.id)).toEqual({ ok: true });
    expect(await db.session.count({ where: { userId: owner } })).toBe(1);
    expect(await requirePasswordReset(admin, owner)).toEqual({ ok: true });
    expect(await db.session.count({ where: { userId: owner } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: owner } })).passwordResetRequired).toBe(true);
    expect(await db.auditLog.count({ where: { action: { in: ["user.sessions.close", "user.password.reset_required"] }, entityId: owner, actorId: admin } })).toBe(2);
  });

  it("admin hisobiga tegilmaydi", async () => {
    expect(await closeSessions(admin, admin)).toEqual({ ok: false, error: "protected" });
    expect(await setUserBlocked(admin, admin, true, "sinov sababi")).toEqual({ ok: false, error: "protected" });
    expect(await changeRole(admin, admin, "STUDENT")).toEqual({ ok: false, error: "protected" });
  });

  it("yaratish, takror raqam, rol almashtirish (biznesi bor — yo'q), bloklash", async () => {
    const created = await createUser(admin, { role: "CASHIER", firstName: "Yangi", lastName: "Kassir", phone: "93 555 98 92", email: EMAIL, password: "Parol2026" });
    expect(created).toMatchObject({ ok: true });
    const id = (created as { id: string }).id;
    expect(await db.user.findUniqueOrThrow({ where: { id } })).toMatchObject({ phone: PHONES[2], email: EMAIL, role: "CASHIER" });
    expect((await db.user.findUniqueOrThrow({ where: { id } })).passwordHash).not.toBeNull();
    expect(await createUser(admin, { role: "STUDENT", firstName: "Takror", lastName: "", phone: PHONES[2]!, email: "", password: "Parol2026" })).toMatchObject({ ok: false, error: "phoneInUse" });
    expect(await createUser(admin, { role: "STUDENT", firstName: "Aloqasiz", lastName: "", phone: "", email: "", password: "Parol2026" })).toMatchObject({ ok: false, error: "invalid" });
    expect(await createUser(admin, { role: "STUDENT", firstName: "Parolsiz", lastName: "", phone: "93 555 98 93", email: "", password: "" })).toMatchObject({ ok: false, error: "invalid", fields: ["password"] });

    expect(await changeRole(admin, id, "STUDENT")).toEqual({ ok: true });
    expect(await changeRole(admin, owner, "STUDENT")).toEqual({ ok: false, error: "hasRoleData" });

    expect(await setUserBlocked(admin, id, true, "x")).toMatchObject({ ok: false, error: "invalid" });
    expect(await setUserBlocked(admin, id, true, "Qoidabuzarlik")).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id } })).status).toBe("BLOCKED");
    expect(await setUserBlocked(admin, id, false, "")).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id } })).status).not.toBe("BLOCKED");
  });
});

describe("admin: chegirmalar", () => {
  it("to'liq tahrir holatni o'zgartirmaydi va qayta tekshiruvga yubormaydi; oldin → keyin auditda", async () => {
    const saved = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    await db.discount.update({ where: { id: saved.id }, data: { status: "ACTIVE" } });
    const r = await saveDiscountByAdmin(admin, saved.id, { ...DRAFT, title: "Admin tahriri", percent: 35 });
    expect(r).toEqual({ ok: true });
    expect(await db.discount.findUniqueOrThrow({ where: { id: saved.id } })).toMatchObject({ status: "ACTIVE", title: "Admin tahriri", percent: 35 });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "discount.edit.admin", entityId: saved.id } });
    expect(log.meta).toMatchObject({ changed: { title: [DRAFT.title, "Admin tahriri"], percent: [20, 35] } });
    expect(await saveDiscountByAdmin(admin, saved.id, { ...DRAFT, percent: 0 })).toMatchObject({ ok: false, error: "errors" });
  });

  it("to'xtatish/yoqish va tarixsiz chegirmani o'chirish", async () => {
    const saved = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    expect(await setDiscountStatusByAdmin(admin, saved.id, false)).toEqual({ ok: false, error: "invalid" });
    await db.discount.update({ where: { id: saved.id }, data: { status: "ACTIVE" } });
    expect(await setDiscountStatusByAdmin(admin, saved.id, false)).toEqual({ ok: true });
    expect((await db.discount.findUniqueOrThrow({ where: { id: saved.id } })).status).toBe("PAUSED");
    expect(await setDiscountStatusByAdmin(admin, saved.id, true)).toEqual({ ok: true });
    expect(await deleteDiscountByAdmin(admin, saved.id)).toEqual({ ok: true });
    expect(await db.discount.findUnique({ where: { id: saved.id } })).toBeNull();
    expect(await db.auditLog.count({ where: { action: "discount.delete.admin", entityId: saved.id, actorId: admin } })).toBe(1);
  });
});

describe("faoliyat jurnali", () => {
  it("bo'lim, obyekt, bajaruvchi va sana bo'yicha filtr", async () => {
    await setBusinessPermissions(admin, businessId, { ...ALLOW_ALL, canPreorder: false });
    const byEntity = await journal({ ...NO_FILTER, entity: "Business", entityId: businessId });
    expect(byEntity.rows.map((r) => r.action)).toContain("business.permissions");
    const byGroup = await journal({ ...NO_FILTER, group: "business", entityId: businessId });
    expect(byGroup.rows.every((r) => r.action.startsWith("business."))).toBe(true);
    expect((await journal({ ...NO_FILTER, group: "discount", entityId: businessId })).total).toBe(0);
    const byActor = await journal({ ...NO_FILTER, actor: "SuperItest", entityId: businessId });
    expect(byActor.rows[0]?.actor?.id).toBe(admin);
    expect((await journal({ ...NO_FILTER, entityId: businessId, from: "2099-01-01" })).total).toBe(0);
    expect((await journal({ ...NO_FILTER, entityId: businessId, from: today, to: today })).total).toBeGreaterThan(0);
  });
});

describe("landing rejimlari", () => {
  const settings = { statsMode: "AUTO", statsStudents: null, statsBusinesses: null, statsDiscounts: null, statsSaved: null, dealsMode: "AUTO", dealIds: [] as string[] };

  it("raqamlar: yashirin — bo'lim yo'q; qo'lda — kiritilgani, bo'shi bazadan", async () => {
    expect(await saveLandingSettings(admin, { ...settings, statsMode: "HIDDEN" })).toEqual({ ok: true });
    expect(await landingStatsSection(new Date())).toBeNull();
    await saveLandingSettings(admin, { ...settings, statsMode: "MANUAL", statsStudents: 12345 });
    const auto = await landingStats(new Date());
    expect(await landingStatsSection(new Date())).toEqual({ force: true, stats: { ...auto, students: 12345 } });
    expect(await db.auditLog.count({ where: { action: "landing.settings", actorId: admin } })).toBe(2);
  });

  it("chegirmalar: tanlanganlar — faqat ular; aralash — avval tanlangan, keyin avtomatik", async () => {
    await saveLandingSettings(admin, settings);
    const auto = await landingDeals(new Date(), 4);
    if (auto.length < 2) return; // seed'da chegirma kam — tekshirib bo'lmaydi
    const pick = auto[auto.length - 1]!.id;
    await saveLandingSettings(admin, { ...settings, dealsMode: "MANUAL", dealIds: [pick, "yoq-id"] });
    expect((await landingDeals(new Date(), 4)).map((d) => d.id)).toEqual([pick]);
    await saveLandingSettings(admin, { ...settings, dealsMode: "MIXED", dealIds: [pick] });
    const mixed = (await landingDeals(new Date(), 4)).map((d) => d.id);
    expect(mixed[0]).toBe(pick);
    expect(new Set(mixed).size).toBe(mixed.length);
    expect(mixed).toHaveLength(Math.min(4, auto.length));
  });

  it("hamkorlar: tartib, yashirish va qo'lda qo'shilgan brend", async () => {
    await savePartner(admin, { businessId }, { sort: -999, hidden: false });
    expect((await landingPartners()).businesses[0]?.name).toBe("Super itest kafe");
    await savePartner(admin, { businessId }, { sort: -999, hidden: true });
    expect((await landingPartners()).businesses.map((b) => b.name)).not.toContain("Super itest kafe");
    const custom = await addCustomPartner(admin, CUSTOM);
    expect(custom).toMatchObject({ ok: true });
    await savePartner(admin, { partnerId: (custom as { id: string }).id }, { sort: -1000, hidden: false });
    expect((await landingPartners()).businesses[0]).toMatchObject({ name: CUSTOM, logoUrl: null });
  });
});
