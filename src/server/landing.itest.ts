import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { landingPartners, landingStats } from "./landing";

// Faqat shu test ishlatadigan raqamlar va STIR
const PHONES = ["+998000000341", "+998000000342"];
const TINS = ["900000341", "900000342"];
const NAMES = ["Landing itest faol", "Landing itest o'chirilgan"];

async function cleanup() {
  await db.business.deleteMany({ where: { tin: { in: TINS } } });
  await db.user.deleteMany({ where: { OR: [{ phone: { in: PHONES } }, { phone: { startsWith: "deleted:" }, firstName: "LandingItest" }] } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("landing: hamkorlar", () => {
  it("egasi hisobini o'chirgan biznes ro'yxatda ham, sonida ham yo'q", async () => {
    const before = (await landingStats(new Date())).businesses;
    for (const i of [0, 1]) {
      const owner = await db.user.create({ data: { phone: PHONES[i]!, role: "BUSINESS_OWNER", firstName: "LandingItest" } });
      await db.business.create({
        data: { ownerId: owner.id, name: NAMES[i]!, tin: TINS[i]!, kind: "CAFE", address: "Bunyodkor 1", workingHours: "09–22", status: "APPROVED", reviewedAt: new Date(Date.now() + 60_000) },
      });
    }
    await db.user.update({ where: { phone: PHONES[1] }, data: { status: "DELETED", phone: "deleted:landing-itest" } });

    const businesses = (await landingPartners()).businesses.map((b) => b.name);
    expect(businesses).toContain(NAMES[0]);
    expect(businesses).not.toContain(NAMES[1]);
    expect((await landingStats(new Date())).businesses).toBe(before + 1);
  });
});
