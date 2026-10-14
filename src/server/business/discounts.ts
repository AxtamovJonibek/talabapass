import "server-only";
import { contentChanged, validateDiscount, type DiscountDraft, type DiscountField, type DiscountProblem } from "@/lib/discount";
import { toTashkent } from "@/lib/time";
import type { BusinessKind, DiscountStatus } from "@/generated/prisma/client";
import { audit } from "../audit";
import { db } from "../db";

/** Biznes turi → chegirma kategoriyasi (lentadagi ikonka va rang). Egasi keyin o'zgartira olmaydi — admin. */
export const CATEGORY_BY_KIND: Record<BusinessKind, string> = {
  CAFE: "taom",
  SHOP: "kitob",
  SERVICE: "xizmat",
  SPORT: "sport",
  BEAUTY: "gozal",
  EDUCATION: "kitob",
  ENTERTAINMENT: "kino",
};

export const todayInTashkent = (now = new Date()) => toTashkent(now).date.toISOString().slice(0, 10);
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const asIso = (date: Date) => date.toISOString().slice(0, 10);

/** Egasining chegirma yarata oladigan biznesi: bloklangan yoki rad etilganida — yo'q. */
export async function ownerBusinessForDiscounts(ownerId: string) {
  const business = await db.business.findFirst({
    where: { ownerId, status: { in: ["PENDING", "APPROVED", "WARNED"] }, submittedAt: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, kind: true, status: true },
  });
  return business;
}

/** Tahrirlash formasi uchun: o'z biznesining chegirmasi (boshqa biznesniki — null). */
export async function ownDiscount(ownerId: string, discountId: string) {
  const discount = await db.discount.findFirst({
    where: { id: discountId, business: { ownerId } },
    select: {
      id: true,
      title: true,
      type: true,
      originalPrice: true,
      percent: true,
      newPrice: true,
      weekdays: true,
      fromMinute: true,
      toMinute: true,
      dailyLimit: true,
      perStudentLimit: true,
      startsOn: true,
      endsOn: true,
      terms: true,
      status: true,
      rejectReason: true,
      category: { select: { icon: true, tileColor: true, inkColor: true } },
    },
  });
  if (!discount) return null;
  const draft: DiscountDraft = {
    title: discount.title,
    type: discount.type,
    originalPrice: discount.originalPrice,
    percent: discount.percent,
    newPrice: discount.newPrice,
    weekdays: discount.weekdays,
    fromMinute: discount.fromMinute,
    toMinute: discount.toMinute,
    dailyLimit: discount.dailyLimit,
    perStudentLimit: discount.perStudentLimit,
    startsOn: asIso(discount.startsOn),
    endsOn: asIso(discount.endsOn),
    terms: discount.terms ?? "",
  };
  return { id: discount.id, status: discount.status, rejectReason: discount.rejectReason, category: discount.category, draft };
}

export type SaveIntent = "draft" | "publish";
export type SaveDiscountResult =
  | { ok: true; id: string; status: DiscountStatus }
  | { ok: false; error: "noBusiness" | "notFound" | "notEditable" }
  | { ok: false; errors: Partial<Record<DiscountField, DiscountProblem>> };

/** Faqat kerakli tur maydonlari saqlanadi (masalan, foizli chegirmada eski "yangi narx" qolmaydi). */
function normalize(d: DiscountDraft): DiscountDraft {
  return {
    ...d,
    title: d.title.trim(),
    terms: d.terms.trim(),
    percent: d.type === "PERCENT" ? d.percent : null,
    newPrice: d.type === "FIXED_PRICE" ? d.newPrice : null,
    weekdays: [...new Set(d.weekdays)].sort((a, b) => a - b),
  };
}

const fields = (d: DiscountDraft) => ({
  title: d.title,
  type: d.type,
  originalPrice: d.originalPrice,
  percent: d.percent,
  newPrice: d.newPrice,
  weekdays: d.weekdays,
  fromMinute: d.fromMinute!,
  toMinute: d.toMinute!,
  dailyLimit: d.dailyLimit!,
  perStudentLimit: d.perStudentLimit,
  startsOn: asDate(d.startsOn),
  endsOn: asDate(d.endsOn),
  terms: d.terms || null,
});

/**
 * Chegirmani yaratish yoki tahrirlash (B2 / WB2). Har bir yangi chegirma admin tekshiruvidan o'tadi:
 * "E'lon qilish" → `PENDING_REVIEW`, "Qoralama" → `DRAFT`.
 * Tasdiqlangan (faol yoki to'xtatilgan) chegirmada mazmun (nom, tur, narx/foiz, shartlar) o'zgarsa — yana
 * `PENDING_REVIEW` (talabalardan yashiriladi); faqat kun/soat/limit/muddat o'zgarsa — holati saqlanadi.
 * Avval berilgan kuponlar o'z shartlari bilan qoladi (Coupon.terms* snapshot).
 */
export async function saveDiscount(ownerId: string, discountId: string | null, raw: DiscountDraft, intent: SaveIntent): Promise<SaveDiscountResult> {
  const business = await ownerBusinessForDiscounts(ownerId);
  if (!business) return { ok: false, error: "noBusiness" };

  const draft = normalize(raw);
  const existing = discountId ? await ownDiscount(ownerId, discountId) : null;
  if (discountId && !existing) return { ok: false, error: "notFound" };

  const errors = validateDiscount(draft, todayInTashkent());
  // Tahrirlashda allaqachon boshlangan chegirmaning boshlanish sanasi o'tmishda bo'lishi tabiiy
  if (existing && errors.dates === "startInPast" && draft.startsOn === existing.draft.startsOn) delete errors.dates;
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  if (!existing) {
    const category = await db.category.findUniqueOrThrow({ where: { slug: CATEGORY_BY_KIND[business.kind] }, select: { id: true } });
    const status: DiscountStatus = intent === "publish" ? "PENDING_REVIEW" : "DRAFT";
    const created = await db.$transaction(async (tx) => {
      const created = await tx.discount.create({ data: { ...fields(draft), businessId: business.id, categoryId: category.id, status }, select: { id: true } });
      if (status === "PENDING_REVIEW") await audit({ actorId: ownerId, action: "discount.submit", entity: "Discount", entityId: created.id }, tx);
      return created;
    });
    return { ok: true, id: created.id, status };
  }

  let status: DiscountStatus;
  switch (existing.status) {
    case "DRAFT":
    case "REJECTED":
    case "PENDING_REVIEW":
      status = intent === "publish" ? "PENDING_REVIEW" : "DRAFT";
      break;
    case "ACTIVE":
    case "PAUSED":
      status = contentChanged(existing.draft, draft) ? "PENDING_REVIEW" : existing.status;
      break;
    default:
      return { ok: false, error: "notEditable" };
  }

  await db.$transaction(async (tx) => {
    // Holat o'zgarmagan bo'lsagina yoziladi (admin shu payt tasdiqlagan bo'lsa — qayta urinish kerak)
    const updated = await tx.discount.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { ...fields(draft), status, ...(status === "PENDING_REVIEW" ? { rejectReason: null } : {}) },
    });
    if (updated.count === 0) throw new Error("Chegirma holati o'zgardi");
    if (status === "PENDING_REVIEW" && existing.status !== "PENDING_REVIEW") {
      await audit({ actorId: ownerId, action: "discount.submit", entity: "Discount", entityId: existing.id, meta: { from: existing.status } }, tx);
    }
  });
  return { ok: true, id: existing.id, status };
}

/** Faol chegirmani to'xtatish yoki qayta yoqish (B5 switch). Tekshiruvsiz; boshqa holatlarda — yo'q. */
export async function setDiscountActive(ownerId: string, discountId: string, active: boolean): Promise<boolean> {
  const updated = await db.discount.updateMany({
    where: { id: discountId, business: { ownerId }, status: active ? "PAUSED" : "ACTIVE" },
    data: { status: active ? "ACTIVE" : "PAUSED" },
  });
  return updated.count === 1;
}

const HINT_MIN_SALES = 20;
const HINT_DAYS = 60;

/**
 * WB2 maslahati: talabalar qaysi kun turi (ish kuni / dam olish) va soatda kelishi — oxirgi 60 kunlik sotuvlardan,
 * 08:00–24:00 ikki soatlik ustunlarda. Sotuv kam bo'lsa — null (taxminiy maslahat berilmaydi).
 */
export async function visitHint(ownerId: string) {
  const rows = await db.$queryRaw<{ weekend: boolean; slot: number; sales: number }[]>`
    SELECT (EXTRACT(ISODOW FROM r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') >= 6) AS weekend,
           FLOOR((EXTRACT(HOUR FROM r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') - 8) / 2)::int AS slot,
           COUNT(*)::int AS sales
    FROM "Redemption" r JOIN "Business" b ON b.id = r."businessId"
    WHERE b."ownerId" = ${ownerId} AND r."createdAt" > now() - make_interval(days => ${HINT_DAYS})
      AND EXTRACT(HOUR FROM r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent') >= 8
    GROUP BY 1, 2`;
  return hintFromCounts(rows);
}

/** Sof hisob (test bilan): sotuvlar → daraja 0–3, eng gavjum va eng bo'sh payt. */
export function hintFromCounts(rows: { weekend: boolean; slot: number; sales: number }[]) {
  const counts: [number[], number[]] = [Array(8).fill(0), Array(8).fill(0)];
  for (const r of rows) if (r.slot >= 0 && r.slot < 8) counts[r.weekend ? 1 : 0][r.slot] += r.sales;
  const total = counts.flat().reduce((a, b) => a + b, 0);
  if (total < HINT_MIN_SALES) return null;
  const max = Math.max(...counts.flat());
  const levels = counts.map((row) => row.map((n) => (n === 0 ? 0 : n / max < 0.34 ? 1 : n / max < 0.67 ? 2 : 3))) as [number[], number[]];
  let peak = { row: 0 as 0 | 1, slot: 0 };
  counts.forEach((row, r) => row.forEach((n, slot) => n > counts[peak.row][peak.slot] && (peak = { row: r as 0 | 1, slot })));
  // Eng bo'sh payt — sotuv bo'lgan (demak ochiq) ustunlar ichidan; nol ustun yopiq vaqt bo'lishi mumkin
  let quiet = peak;
  counts.forEach((row, r) => row.forEach((n, slot) => n > 0 && n < counts[quiet.row][quiet.slot] && (quiet = { row: r as 0 | 1, slot })));
  return { levels, peak: { row: peak.row, hour: 8 + peak.slot * 2 }, quiet: { row: quiet.row, hour: 8 + quiet.slot * 2 } };
}

/**
 * Egasining chegirmalari (B5 ro'yxati): bugungi sotuvlar soni bilan. Tugaganlari oxirida.
 */
export async function ownerDiscounts(ownerId: string) {
  const today = new Date(`${todayInTashkent()}T00:00:00Z`);
  const discounts = await db.discount.findMany({
    where: { business: { ownerId } },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      originalPrice: true,
      percent: true,
      newPrice: true,
      weekdays: true,
      fromMinute: true,
      toMinute: true,
      dailyLimit: true,
      endsOn: true,
      status: true,
      rejectReason: true,
      days: { where: { date: today }, select: { redeemed: true } },
    },
  });
  const order: Record<DiscountStatus, number> = { ACTIVE: 0, PENDING_REVIEW: 1, PAUSED: 2, REJECTED: 3, DRAFT: 4, ENDED: 5 };
  return discounts
    .map(({ days, endsOn, ...d }) => ({ ...d, endsOn: asIso(endsOn), soldToday: days[0]?.redeemed ?? 0 }))
    .sort((a, b) => order[a.status] - order[b.status]);
}
export type OwnerDiscount = Awaited<ReturnType<typeof ownerDiscounts>>[number];
