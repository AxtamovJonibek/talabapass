import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toTashkent } from "@/lib/time";
import { db } from "../db";
import { dealDetail, feedDeals } from "./feed";

const PHONE = "+998935559890";
const TIN = "309109890";
const DAY_MS = 86_400_000;
const ALL_WEEK = [1, 2, 3, 4, 5, 6, 7];

let businessId: string;
let categoryId: string;

async function cleanup() {
  await db.business.deleteMany({ where: { tin: TIN } });
  await db.user.deleteMany({ where: { phone: PHONE } });
}

const now = new Date();
const today = toTashkent(now).date;
const minute = toTashkent(now).minute;

/** Hozir ochiq (yoki — `open: false` — hozir yopiq, ertaga ochiladigan) chegirma */
async function makeDiscount(over: { status?: "ACTIVE" | "PENDING_REVIEW" | "PAUSED"; open?: boolean; endsOn?: Date } = {}) {
  const open = over.open ?? true;
  // Ochiq: oraliq hozirgi daqiqani o'z ichiga oladi; yopiq: 2 soatdan keyin boshlanadigan 30 daqiqalik oraliq
  const closedFrom = (minute + 120) % 1440;
  const [fromMinute, toMinute] = open ? [Math.max(0, minute - 30), Math.min(1440, minute + 60)] : [closedFrom, (closedFrom + 30) % 1440];
  return db.discount.create({
    data: {
      businessId,
      categoryId,
      title: "Itest osh",
      type: "PERCENT",
      originalPrice: 38000,
      percent: 30,
      weekdays: ALL_WEEK,
      fromMinute,
      toMinute,
      dailyLimit: 60,
      startsOn: new Date(today.getTime() - 5 * DAY_MS),
      endsOn: over.endsOn ?? new Date(today.getTime() + 20 * DAY_MS),
      status: over.status ?? "ACTIVE",
    },
  });
}

beforeEach(async () => {
  await cleanup();
  const owner = await db.user.create({ data: { phone: PHONE, role: "BUSINESS_OWNER" } });
  const business = await db.business.create({
    data: { ownerId: owner.id, name: "Itest Choyxona", tin: TIN, kind: "CAFE", address: "Bunyodkor 1", workingHours: "09–22", status: "APPROVED", submittedAt: new Date(), lat: 41.28, lng: 69.2 },
  });
  businessId = business.id;
  categoryId = (await db.category.findFirstOrThrow({ where: { slug: "taom" } })).id;
});
afterAll(cleanup);

const ids = async () => (await feedDeals(new Date(), null)).map((d) => d.id);

describe("talaba lentasi", () => {
  it("faqat tasdiqlangan (ACTIVE) chegirma va tasdiqlangan biznes", async () => {
    const active = await makeDiscount();
    const pending = await makeDiscount({ status: "PENDING_REVIEW" });
    const paused = await makeDiscount({ status: "PAUSED" });
    let list = await ids();
    expect(list).toContain(active.id);
    expect(list).not.toContain(pending.id);
    expect(list).not.toContain(paused.id);

    for (const status of ["PENDING", "REJECTED", "BLOCKED"] as const) {
      await db.business.update({ where: { id: businessId }, data: { status } });
      list = await ids();
      expect(list, status).not.toContain(active.id);
      expect(await dealDetail(active.id, new Date(), null), status).toBeNull();
    }
  });

  it("muddati tugagan chegirma chiqmaydi", async () => {
    const ended = await makeDiscount({ endsOn: new Date(today.getTime() - 3 * DAY_MS) });
    expect(await ids()).not.toContain(ended.id);
  });

  it("kunlik qoldiq — shu kungi DiscountDay.claimed dan", async () => {
    const d = await makeDiscount();
    await db.discountDay.create({ data: { discountId: d.id, date: today, claimed: 34, redeemed: 30 } });
    // Kechagi hisob bugungi qoldiqqa ta'sir qilmaydi
    await db.discountDay.create({ data: { discountId: d.id, date: new Date(today.getTime() - DAY_MS), claimed: 60, redeemed: 60 } });
    const deal = (await feedDeals(new Date(), { lat: 41.28, lng: 69.2 })).find((x) => x.id === d.id)!;
    expect(deal).toMatchObject({ live: true, left: 26, total: 60, badge: "−30%", price: { now: 26600, old: 38000 } });
    expect(deal.distanceKm).toBe(0);
  });

  it("yopiq chegirma: keyingi ochilish vaqti bilan, qoldiq o'sha kun bo'yicha", async () => {
    const d = await makeDiscount({ open: false });
    const deal = (await feedDeals(new Date(), null)).find((x) => x.id === d.id)!;
    expect(deal.live).toBe(false);
    expect(Date.parse(deal.opensAt!)).toBeGreaterThan(Date.now());
    expect(deal.left).toBe(60);
  });
});
