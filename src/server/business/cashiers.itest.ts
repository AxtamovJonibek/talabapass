import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { acceptInvite, cashierBusiness, createInvite, INVITE_TTL_MS, inviteByToken, ownerCashiers, removeCashier, revokeInvite } from "./cashiers";
import { cleanBusinessInfo, createBusinessOwner } from "./registration";

const OWNERS = ["+998935559890", "+998935559891"];
const TINS = ["309109890", "309109891"];
const CASHIER = "+998935559892";
const NAME = { firstName: "Jasur", lastName: "Toshmatov" };
let ownerA: string;
let ownerB: string;

async function makeOwner(phone: string, tin: string) {
  const info = cleanBusinessInfo({ name: `Itest ${tin}`, kind: "CAFE", address: "Chilonzor 1", workingHours: "09–22", description: "", tin, contactName: "Itest Egasi" });
  if (!info.ok) throw new Error("info");
  const created = await createBusinessOwner(phone, info.info);
  if (!created.ok) throw new Error(created.error);
  await db.business.updateMany({ where: { ownerId: created.userId }, data: { status: "APPROVED", submittedAt: new Date() } });
  return created.userId;
}

async function cleanup() {
  await db.business.deleteMany({ where: { OR: [{ tin: { in: TINS } }, { owner: { phone: { in: OWNERS } } }] } });
  await db.user.deleteMany({ where: { phone: { in: [...OWNERS, CASHIER] } } });
}

const sessionFor = (userId: string) =>
  db.session.create({ data: { userId, tokenHash: createHash("sha256").update(randomBytes(16)).digest("hex"), expiresAt: new Date(Date.now() + 86_400_000) } });

beforeEach(async () => {
  await cleanup();
  ownerA = await makeOwner(OWNERS[0], TINS[0]);
  ownerB = await makeOwner(OWNERS[1], TINS[1]);
});
afterAll(cleanup);

async function invite(owner: string, now?: Date) {
  const r = await createInvite(owner, now);
  if (!r.ok) throw new Error(r.error);
  return r.token;
}

describe("kassir taklifi", () => {
  it("faqat tasdiqlangan biznes taklif qiladi; bazada token emas, xeshi", async () => {
    await db.business.updateMany({ where: { ownerId: ownerA }, data: { status: "PENDING" } });
    expect(await createInvite(ownerA)).toEqual({ ok: false, error: "notApproved" });
    const token = await invite(ownerB);
    expect(await db.cashierInvite.count({ where: { tokenHash: token } })).toBe(0);
  });

  it("bir martalik: qabul qilingach havola ishlamaydi; kassir hisobi va a'zolik yaratiladi", async () => {
    const token = await invite(ownerA);
    expect(await inviteByToken(token)).toMatchObject({ businessName: `Itest ${TINS[0]}` });
    const accepted = await acceptInvite(token, CASHIER, NAME);
    expect(accepted.ok).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { phone: CASHIER } });
    expect(user).toMatchObject({ role: "CASHIER", firstName: "Jasur" });
    expect((await cashierBusiness(user.id))?.name).toBe(`Itest ${TINS[0]}`);

    expect(await inviteByToken(token)).toBeNull();
    expect(await acceptInvite(token, "+998935559893", NAME)).toEqual({ ok: false, error: "invalid" });
  });

  it("48 soatdan keyin eskiradi", async () => {
    const issued = new Date(Date.now() - INVITE_TTL_MS - 60_000);
    const token = await invite(ownerA, issued);
    expect(await inviteByToken(token)).toBeNull();
    expect(await acceptInvite(token, CASHIER, NAME)).toEqual({ ok: false, error: "invalid" });
    // 47 soat — hali amal qiladi
    const fresh = await invite(ownerA, new Date(Date.now() - 47 * 3_600_000));
    expect(await inviteByToken(fresh)).not.toBeNull();
  });

  it("parallel qabul: faqat bittasi o'tadi", async () => {
    const token = await invite(ownerA);
    const results = await Promise.all([acceptInvite(token, CASHIER, NAME), acceptInvite(token, "+998935559893", NAME)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    await db.user.deleteMany({ where: { phone: "+998935559893" } });
  });

  it("kassir faqat bitta biznesda; boshqa roldagi raqam kassir bo'lmaydi", async () => {
    await acceptInvite(await invite(ownerA), CASHIER, NAME);
    expect(await acceptInvite(await invite(ownerB), CASHIER, NAME)).toEqual({ ok: false, error: "otherBusiness" });
    expect(await acceptInvite(await invite(ownerB), OWNERS[0], NAME)).toEqual({ ok: false, error: "phoneInUse" });
  });

  it("egasi o'chirsa — a'zolik yopiladi va sessiyalari darhol bekor; boshqa biznes egasi o'chira olmaydi", async () => {
    await acceptInvite(await invite(ownerA), CASHIER, NAME);
    const cashier = await db.user.findUniqueOrThrow({ where: { phone: CASHIER } });
    await sessionFor(cashier.id);
    await sessionFor(cashier.id);
    const { cashiers } = await ownerCashiers(ownerA);
    expect(cashiers).toHaveLength(1);

    expect(await removeCashier(ownerB, cashiers[0].memberId)).toBe(false);
    expect(await db.session.count({ where: { userId: cashier.id } })).toBe(2);

    expect(await removeCashier(ownerA, cashiers[0].memberId)).toBe(true);
    expect(await db.session.count({ where: { userId: cashier.id } })).toBe(0);
    expect(await cashierBusiness(cashier.id)).toBeNull();
    expect((await ownerCashiers(ownerA)).cashiers).toHaveLength(0);

    // Qayta taklif qilinsa — o'sha hisob qaytadan ulanadi
    expect((await acceptInvite(await invite(ownerB), CASHIER, NAME)).ok).toBe(true);
    expect((await cashierBusiness(cashier.id))?.name).toBe(`Itest ${TINS[1]}`);
  });

  it("ochiq taklifni bekor qilish — faqat o'z biznesida", async () => {
    await invite(ownerA);
    const [open] = (await ownerCashiers(ownerA)).invites;
    expect(await revokeInvite(ownerB, open.id)).toBe(false);
    expect(await revokeInvite(ownerA, open.id)).toBe(true);
    expect((await ownerCashiers(ownerA)).invites).toHaveLength(0);
  });
});
