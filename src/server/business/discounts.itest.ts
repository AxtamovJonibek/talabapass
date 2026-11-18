import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { DiscountDraft } from "@/lib/discount";
import { db } from "../db";
import { hintFromCounts, ownDiscount, saveDiscount, setDiscountActive, todayInTashkent } from "./discounts";
import { cleanBusinessInfo, createBusinessOwner } from "./registration";

const PHONES = ["+998935559880", "+998935559881"];
const TINS = ["309109880", "309109881"];
let owner: string;
let other: string;

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const today = todayInTashkent();
const DRAFT: DiscountDraft = {
  title: "Osh 0.5 porsiya + choy",
  type: "PERCENT",
  originalPrice: 38000,
  percent: 30,
  newPrice: null,
  weekdays: [1, 2, 3, 4, 5],
  fromMinute: 720,
  toMinute: 900,
  dailyLimit: 60,
  perStudentLimit: "DAILY",
  startsOn: today,
  endsOn: addDays(today, 20),
  terms: "",
};

async function makeOwner(phone: string, tin: string, submitted = true) {
  const info = cleanBusinessInfo({ name: "Itest", kind: "CAFE", address: "Bunyodkor 1, Chilonzor", workingHours: "09–22", description: "", tin, contactName: "Itest Egasi" });
  if (!info.ok) throw new Error("info");
  const created = await createBusinessOwner(phone, info.info);
  if (!created.ok) throw new Error(created.error);
  if (submitted) await db.business.updateMany({ where: { ownerId: created.userId }, data: { submittedAt: new Date(), status: "APPROVED" } });
  return created.userId;
}

async function cleanup() {
  await db.business.deleteMany({ where: { OR: [{ tin: { in: TINS } }, { owner: { phone: { in: PHONES } } }] } });
  await db.user.deleteMany({ where: { phone: { in: PHONES } } });
}

const status = async (id: string) => (await db.discount.findUniqueOrThrow({ where: { id } })).status;

beforeEach(async () => {
  await cleanup();
  owner = await makeOwner(PHONES[0], TINS[0]);
  other = await makeOwner(PHONES[1], TINS[1]);
});
afterAll(cleanup);

describe("chegirma yaratish va moderatsiya", () => {
  it("E'lon qilish → tekshiruvga, qoralama → DRAFT; kategoriya biznes turidan", async () => {
    const published = await saveDiscount(owner, null, DRAFT, "publish");
    expect(published).toMatchObject({ ok: true, status: "PENDING_REVIEW" });
    const draft = await saveDiscount(owner, null, DRAFT, "draft");
    expect(draft).toMatchObject({ ok: true, status: "DRAFT" });
    const saved = await db.discount.findUniqueOrThrow({ where: { id: (published as { id: string }).id }, include: { category: true } });
    expect(saved.category.slug).toBe("taom");
    expect(await db.auditLog.count({ where: { action: "discount.submit", entityId: saved.id } })).toBe(1);
  });

  it("server ham tekshiradi: foiz 1–100, yangi narx < asl, limit > 0, oxiri > boshi", async () => {
    expect(await saveDiscount(owner, null, { ...DRAFT, percent: 101 }, "publish")).toMatchObject({ ok: false, errors: { percent: "percentRange" } });
    expect(await saveDiscount(owner, null, { ...DRAFT, percent: 0 }, "publish")).toMatchObject({ ok: false, errors: { percent: "percentRange" } });
    expect(await saveDiscount(owner, null, { ...DRAFT, type: "FIXED_PRICE", newPrice: 38000 }, "publish")).toMatchObject({
      ok: false,
      errors: { newPrice: "newPriceBelowOriginal" },
    });
    expect(await saveDiscount(owner, null, { ...DRAFT, dailyLimit: 0 }, "publish")).toMatchObject({ ok: false, errors: { dailyLimit: "dailyLimit" } });
    expect(await saveDiscount(owner, null, { ...DRAFT, endsOn: DRAFT.startsOn }, "publish")).toMatchObject({ ok: false, errors: { dates: "endAfterStart" } });
    expect(await db.discount.count({ where: { business: { ownerId: owner } } })).toBe(0);
  });

  it("1% va 100% (bepul) saqlanadi — bazadagi CHECK ham ruxsat beradi", async () => {
    for (const percent of [1, 100]) {
      const r = await saveDiscount(owner, null, { ...DRAFT, percent }, "draft");
      expect(r).toMatchObject({ ok: true });
      expect((await db.discount.findUniqueOrThrow({ where: { id: (r as { id: string }).id } })).percent).toBe(percent);
    }
  });

  it("yarim tundan o'tadigan oraliq saqlanadi (22:00–02:00)", async () => {
    const r = await saveDiscount(owner, null, { ...DRAFT, fromMinute: 1320, toMinute: 120 }, "publish");
    expect(r.ok).toBe(true);
    expect(await db.discount.findUniqueOrThrow({ where: { id: (r as { id: string }).id } })).toMatchObject({ fromMinute: 1320, toMinute: 120 });
  });

  it("ariza yuborilmagan biznes chegirma qo'sha olmaydi", async () => {
    await db.business.updateMany({ where: { ownerId: owner }, data: { submittedAt: null, status: "PENDING" } });
    expect(await saveDiscount(owner, null, DRAFT, "publish")).toEqual({ ok: false, error: "noBusiness" });
  });

  it("faol chegirma: jadval/limit o'zgarsa — faol qoladi; mazmun o'zgarsa — qayta tekshiruvga", async () => {
    const r = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    await db.discount.update({ where: { id: r.id }, data: { status: "ACTIVE", rejectReason: null } });

    await saveDiscount(owner, r.id, { ...DRAFT, dailyLimit: 80, fromMinute: 660, weekdays: [6, 7] }, "publish");
    expect(await status(r.id)).toBe("ACTIVE");

    await saveDiscount(owner, r.id, { ...DRAFT, percent: 40 }, "publish");
    expect(await status(r.id)).toBe("PENDING_REVIEW");

    await db.discount.update({ where: { id: r.id }, data: { status: "PAUSED" } });
    await saveDiscount(owner, r.id, { ...DRAFT, percent: 40, title: "Boshqa nom" }, "publish");
    expect(await status(r.id)).toBe("PENDING_REVIEW");
  });

  it("rad etilgani tuzatilib qayta yuboriladi, sabab tozalanadi", async () => {
    const r = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    await db.discount.update({ where: { id: r.id }, data: { status: "REJECTED", rejectReason: "Narx noto'g'ri" } });
    await saveDiscount(owner, r.id, { ...DRAFT, originalPrice: 40000 }, "publish");
    expect(await db.discount.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "PENDING_REVIEW", rejectReason: null, originalPrice: 40000 });
  });

  it("tugagan chegirma o'zgarmaydi; begona biznes chegirmasi — topilmaydi", async () => {
    const r = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    expect(await saveDiscount(other, r.id, DRAFT, "publish")).toEqual({ ok: false, error: "notFound" });
    expect(await ownDiscount(other, r.id)).toBeNull();
    expect(await setDiscountActive(other, r.id, false)).toEqual({ ok: false, error: "notEditable" });
    await db.discount.update({ where: { id: r.id }, data: { status: "ENDED" } });
    expect(await saveDiscount(owner, r.id, DRAFT, "publish")).toEqual({ ok: false, error: "notEditable" });
  });

  it("switch: faqat faol ↔ to'xtatilgan; tekshiruvdagini yoqib bo'lmaydi", async () => {
    const r = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    expect(await setDiscountActive(owner, r.id, true)).toEqual({ ok: false, error: "notEditable" });
    expect(await status(r.id)).toBe("PENDING_REVIEW");
    await db.discount.update({ where: { id: r.id }, data: { status: "ACTIVE" } });
    expect(await setDiscountActive(owner, r.id, false)).toEqual({ ok: true });
    expect(await status(r.id)).toBe("PAUSED");
    expect(await setDiscountActive(owner, r.id, true)).toEqual({ ok: true });
    expect(await status(r.id)).toBe("ACTIVE");
  });
});

describe("admin ruxsatlari (BusinessPermissions)", () => {
  const businessOf = async (ownerId: string) => (await db.business.findFirstOrThrow({ where: { ownerId } })).id;
  const setPermissions = async (ownerId: string, data: Record<string, unknown>) => {
    const businessId = await businessOf(ownerId);
    await db.businessPermissions.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
  };

  it("chegirma yaratish o'chiq — yangisi yo'q, mavjudi tahrirlanadi", async () => {
    const r = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    await setPermissions(owner, { canCreateDiscounts: false });
    expect(await saveDiscount(owner, null, DRAFT, "publish")).toEqual({ ok: false, error: "noPermission" });
    expect(await saveDiscount(owner, r.id, { ...DRAFT, title: "Yangi nom" }, "publish")).toMatchObject({ ok: true });
  });

  it("avtomatik tasdiq — yuborilgani darhol ACTIVE, mazmun o'zgarsa ham tekshiruvsiz", async () => {
    await setPermissions(owner, { autoApproveDiscounts: true });
    const r = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    expect(await status(r.id)).toBe("ACTIVE");
    await saveDiscount(owner, r.id, { ...DRAFT, percent: 45 }, "publish");
    expect(await status(r.id)).toBe("ACTIVE");
    expect(await db.auditLog.count({ where: { action: "discount.autoapprove", entityId: r.id } })).toBeGreaterThan(0);
  });

  it("faollar chegarasi: yoqish va avtomatik tasdiq chegaradan oshmaydi", async () => {
    await setPermissions(owner, { autoApproveDiscounts: true, maxActiveDiscounts: 1 });
    const a = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    expect(await status(a.id)).toBe("ACTIVE");
    expect(await saveDiscount(owner, null, DRAFT, "publish")).toEqual({ ok: false, error: "activeLimit" });
    const b = (await saveDiscount(owner, null, DRAFT, "draft")) as { id: string };
    await db.discount.update({ where: { id: b.id }, data: { status: "PAUSED" } });
    expect(await setDiscountActive(owner, b.id, true)).toEqual({ ok: false, error: "activeLimit" });
    expect(await setDiscountActive(owner, a.id, false)).toEqual({ ok: true });
    expect(await setDiscountActive(owner, b.id, true)).toEqual({ ok: true });
  });

  it("boshqa biznes ruxsati bunga ta'sir qilmaydi", async () => {
    await setPermissions(other, { canCreateDiscounts: false });
    expect(await saveDiscount(owner, null, DRAFT, "publish")).toMatchObject({ ok: true });
  });
});

describe("WB2 maslahati", () => {
  it("sotuv kam — maslahat yo'q", () => {
    expect(hintFromCounts([{ weekend: false, slot: 2, sales: 5 }])).toBeNull();
  });

  it("eng gavjum va eng bo'sh (sotuv bo'lgan) payt", () => {
    const hint = hintFromCounts([
      { weekend: false, slot: 2, sales: 30 },
      { weekend: false, slot: 4, sales: 3 },
      { weekend: true, slot: 1, sales: 12 },
    ]);
    expect(hint).toEqual({
      levels: [
        [0, 0, 3, 0, 1, 0, 0, 0],
        [0, 2, 0, 0, 0, 0, 0, 0],
      ],
      peak: { row: 0, hour: 12 },
      quiet: { row: 0, hour: 16 },
    });
  });
});

describe("admin qarori", () => {
  it("tasdiqlash → faol; rad etish → sabab biznesga; ikkinchi qaror o'tmaydi", async () => {
    const { approveDiscount, rejectDiscount } = await import("../admin/discount-review");
    const a = (await saveDiscount(owner, null, DRAFT, "publish")) as { id: string };
    const b = (await saveDiscount(owner, null, { ...DRAFT, title: "Ikkinchi chegirma" }, "publish")) as { id: string };

    expect(await approveDiscount(a.id, owner)).toEqual({ ok: true });
    expect(await status(a.id)).toBe("ACTIVE");
    expect(await approveDiscount(a.id, owner)).toEqual({ ok: false, error: "not_pending" });

    expect(await rejectDiscount({ discountId: b.id, reasonKey: "unclear", reasonText: "Nom tushunarsiz" }, owner)).toEqual({ ok: true });
    expect(await ownDiscount(owner, b.id)).toMatchObject({ status: "REJECTED", rejectReason: "Nom tushunarsiz" });
    expect(await rejectDiscount({ discountId: a.id, reasonKey: "unclear", reasonText: "x" }, owner)).toEqual({ ok: false, error: "not_pending" });
    expect(await db.auditLog.count({ where: { action: { in: ["discount.approve", "discount.reject"] }, entityId: { in: [a.id, b.id] } } })).toBe(2);

    // Tasdiqlangandan keyin narx o'zgarsa — yana navbatga
    await saveDiscount(owner, a.id, { ...DRAFT, percent: 50 }, "publish");
    expect(await status(a.id)).toBe("PENDING_REVIEW");
  });
});
