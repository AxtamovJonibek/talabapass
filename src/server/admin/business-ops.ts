import "server-only";
import { z } from "zod";
import { validateDiscount } from "@/lib/discount";
import { normalizePhone } from "@/lib/format";
import { audit } from "../audit";
import { invitePhoneByAdmin, removeCashierByAdmin } from "../business/cashiers";
import { CATEGORY_BY_KIND, discountDraftSchema, todayInTashkent } from "../business/discounts";
import { db } from "../db";
import { startsOnOrder } from "./business-ops-rules";
import { logAdminEvent } from "./change-log";
import { setUserBlocked, type SuperResult } from "./super";

/*
 * Admin biznes kartasi (`/admin/bizneslar?id=`): biznes nomidan chegirma yaratish/nusxalash, kassirlar, sotuvni bekor qilish.
 * Chegirmani tahrirlash/to'xtatish/o'chirish — `super.ts` dagi mavjud funksiyalar (qoidalar bitta: `validateDiscount`).
 * Har amal `AuditLog` ga (kim, nima) va egasi ilovada ko'radigan `BusinessChange` ga yoziladi. Chaqiruvchi `requireRole("ADMIN")` qilgan.
 */

export type OpsResult = SuperResult | { ok: false; error: "errors"; errors: Record<string, string> };

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const withTitle = (title: string, text: string) => `«${title}»: ${text}`;

// ───────── chegirmalar ─────────

/** Ro'yxat: holat, muddat, kunlik son, sotilgan (bekor qilinmagan sotuvlar) */
export async function adminDiscountList(businessId: string) {
  const [rows, sold] = await Promise.all([
    db.discount.findMany({
      where: { businessId },
      select: {
        id: true,
        title: true,
        status: true,
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
        createdAt: true,
      },
    }),
    db.redemption.groupBy({ by: ["discountId"], where: { businessId, voidedAt: null }, _count: { _all: true } }),
  ]);
  const count = new Map(sold.map((s) => [s.discountId, s._count._all]));
  return rows
    .map((d) => ({ ...d, startsOn: d.startsOn.toISOString().slice(0, 10), endsOn: d.endsOn.toISOString().slice(0, 10), sold: count.get(d.id) ?? 0 }))
    .sort(startsOnOrder);
}
export type AdminDiscountItem = Awaited<ReturnType<typeof adminDiscountList>>[number];

/**
 * Admin biznes nomidan chegirma yaratadi: darhol faol (admin o'zi tekshiruvchi), faollar chegarasi egaga tegishli —
 * admin uchun qo'llanmaydi. Qoidalar egasiniki bilan bir xil (`validateDiscount`). Kategoriya — biznes turidan.
 */
export async function createDiscountByAdmin(actorId: string, businessId: string, raw: unknown): Promise<OpsResult> {
  const parsed = discountDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const business = await db.business.findUnique({ where: { id: businessId }, select: { kind: true } });
  if (!business) return { ok: false, error: "notFound" };
  const d = parsed.data;
  const draft = { ...d, title: d.title.trim(), terms: d.terms.trim(), percent: d.type === "PERCENT" ? d.percent : null, newPrice: d.type === "FIXED_PRICE" ? d.newPrice : null };
  const errors = validateDiscount(draft, todayInTashkent());
  if (Object.keys(errors).length > 0) return { ok: false, error: "errors", errors: errors as Record<string, string> };
  const category = await db.category.findUniqueOrThrow({ where: { slug: CATEGORY_BY_KIND[business.kind] }, select: { id: true } });
  const created = await db.$transaction(async (tx) => {
    const created = await tx.discount.create({
      data: {
        businessId,
        categoryId: category.id,
        status: "ACTIVE",
        title: draft.title,
        type: draft.type,
        originalPrice: draft.originalPrice,
        percent: draft.percent,
        newPrice: draft.newPrice,
        weekdays: [...new Set(draft.weekdays)].sort((a, b) => a - b),
        fromMinute: draft.fromMinute!,
        toMinute: draft.toMinute!,
        dailyLimit: draft.dailyLimit!,
        perStudentLimit: draft.perStudentLimit,
        startsOn: asDate(draft.startsOn),
        endsOn: asDate(draft.endsOn),
        terms: draft.terms || null,
      },
      select: { id: true },
    });
    await audit({ actorId, action: "discount.create.admin", entity: "Discount", entityId: created.id, meta: { businessId, title: draft.title } }, tx);
    await logAdminEvent(tx, actorId, businessId, "discount_created", null, draft.title);
    return created;
  });
  return { ok: true, id: created.id };
}

/** Nusxa: to'xtatilgan holatda (talabaga ko'rinmaydi), nomi "(nusxa)"; rasmlar ko'chirilmaydi. Admin tahrirlab yoqadi. */
export async function duplicateDiscountByAdmin(actorId: string, discountId: string): Promise<OpsResult> {
  const src = await db.discount.findUnique({ where: { id: discountId } });
  if (!src) return { ok: false, error: "notFound" };
  const title = `${src.title.slice(0, 68)} (nusxa)`;
  const copy = await db.$transaction(async (tx) => {
    const copy = await tx.discount.create({
      data: {
        businessId: src.businessId,
        categoryId: src.categoryId,
        status: "PAUSED",
        title,
        description: src.description,
        type: src.type,
        originalPrice: src.originalPrice,
        percent: src.percent,
        newPrice: src.newPrice,
        note: src.note,
        icon: src.icon,
        tileColor: src.tileColor,
        inkColor: src.inkColor,
        weekdays: src.weekdays,
        fromMinute: src.fromMinute,
        toMinute: src.toMinute,
        dailyLimit: src.dailyLimit,
        perStudentLimit: src.perStudentLimit,
        startsOn: src.startsOn,
        endsOn: src.endsOn,
        terms: src.terms,
      },
      select: { id: true },
    });
    await audit({ actorId, action: "discount.duplicate.admin", entity: "Discount", entityId: copy.id, meta: { from: src.id, businessId: src.businessId } }, tx);
    await logAdminEvent(tx, actorId, src.businessId, "discount_duplicated", src.title, title);
    return copy;
  });
  return { ok: true, id: copy.id };
}

// ───────── kassirlar ─────────

export async function adminCashiers(businessId: string, now = new Date()) {
  const [members, invites] = await Promise.all([
    db.businessMember.findMany({
      where: { businessId, role: "CASHIER", active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, user: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } } },
    }),
    db.cashierInvite.findMany({ where: { businessId, acceptedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" }, select: { id: true, phone: true, expiresAt: true } }),
  ]);
  return {
    cashiers: members.map((m) => ({
      memberId: m.id,
      userId: m.user.id,
      name: [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || "—",
      phone: m.user.phone ?? "",
      blocked: m.user.status === "BLOCKED",
    })),
    invites,
  };
}

export const cashierPhoneSchema = z.object({ businessId: z.string().min(1).max(40), phone: z.string().trim().max(32) });

/** Kassir qo'shish (telefon): taklif yaratiladi, kassir ilovaga shu raqam bilan kirib qabul qiladi */
export async function addCashierByAdmin(actorId: string, raw: unknown): Promise<SuperResult | { ok: false; error: "notApproved" | "tooMany" | "alreadyCashier" }> {
  const parsed = cashierPhoneSchema.safeParse(raw);
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return { ok: false, error: "invalid", fields: ["phone"] };
  const r = await invitePhoneByAdmin(actorId, parsed.data.businessId, phone);
  if (!r.ok) return { ok: false, error: r.error === "noPermission" ? "notApproved" : r.error };
  await db.$transaction((tx) => logAdminEvent(tx, actorId, parsed.data.businessId, "cashier_added", null, phone));
  return { ok: true, id: r.inviteId };
}

export async function removeCashierAsAdmin(actorId: string, businessId: string, memberId: string): Promise<SuperResult> {
  const member = await db.businessMember.findFirst({ where: { id: memberId, businessId, role: "CASHIER", active: true }, select: { user: { select: { phone: true } } } });
  if (!member || !(await removeCashierByAdmin(actorId, businessId, memberId))) return { ok: false, error: "notFound" };
  await db.$transaction((tx) => logAdminEvent(tx, actorId, businessId, "cashier_removed", member.user.phone, null));
  return { ok: true };
}

/** Kassirni bloklash/blokdan chiqarish — faqat `moderation.ts` orqali (`setUserBlocked`); faqat shu biznesning faol kassiri */
export async function blockCashierAsAdmin(actorId: string, businessId: string, userId: string, blocked: boolean, reason: string): Promise<SuperResult> {
  const member = await db.businessMember.findFirst({ where: { businessId, userId, role: "CASHIER", active: true }, select: { user: { select: { phone: true } } } });
  if (!member) return { ok: false, error: "notFound" };
  const r = await setUserBlocked(actorId, userId, blocked, reason);
  if (r.ok) await db.$transaction((tx) => logAdminEvent(tx, actorId, businessId, blocked ? "cashier_blocked" : "cashier_unblocked", member.user.phone, reason.trim() || null));
  return r;
}

// ───────── sotuvni bekor qilish ─────────

export const VOID_REASON_MIN = 3;
export const voidSchema = z.object({ redemptionId: z.string().min(1).max(40), reason: z.string().trim().min(VOID_REASON_MIN).max(200) });

/**
 * Xato sotuvni bekor qilish (sabab majburiy). Qator o'chirilmaydi: `voidedAt` qo'yiladi va u hisobotlar, tushum, talaba
 * tarixi/jamilaridan chiqadi; chegirmaning o'sha kundagi "sotilgan" hisobi 1 ga kamayadi. Faqat bir marta (shartli UPDATE).
 */
export async function voidSale(actorId: string, raw: unknown): Promise<SuperResult> {
  const parsed = voidSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", fields: ["reason"] };
  const { redemptionId, reason } = parsed.data;
  const sale = await db.redemption.findUnique({
    where: { id: redemptionId },
    select: { id: true, businessId: true, discountId: true, receiptNo: true, paidAmount: true, coupon: { select: { date: true, termsTitle: true } } },
  });
  if (!sale) return { ok: false, error: "notFound" };
  const done = await db.$transaction(async (tx) => {
    const r = await tx.redemption.updateMany({ where: { id: sale.id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: reason, voidedById: actorId } });
    if (r.count !== 1) return false;
    await tx.$executeRaw`UPDATE "DiscountDay" SET redeemed = redeemed - 1 WHERE "discountId" = ${sale.discountId} AND date = ${sale.coupon.date}::date AND redeemed > 0`;
    await audit({ actorId, action: "redemption.void.admin", entity: "Redemption", entityId: sale.id, meta: { businessId: sale.businessId, receiptNo: sale.receiptNo, paidAmount: sale.paidAmount, reason } }, tx);
    await logAdminEvent(tx, actorId, sale.businessId, "sale_voided", withTitle(sale.coupon.termsTitle, `№${sale.receiptNo} · ${sale.paidAmount}`), reason);
    return true;
  });
  return done ? { ok: true } : { ok: false, error: "invalid" };
}

// ───────── egasi ilovada ko'radigan jurnal ─────────

/** Egasining "O'zgarishlar" ro'yxati (`GET /api/v1/business/changes`): admin va ega o'zgartirishlari, yangisi tepada */
export async function ownerChanges(businessId: string, take = 50) {
  const rows = await db.businessChange.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take, select: { id: true, actorRole: true, field: true, oldValue: true, newValue: true, createdAt: true } });
  return rows.map((r) => ({ id: r.id, by: r.actorRole === "ADMIN" ? ("admin" as const) : ("owner" as const), field: r.field, oldValue: r.oldValue, newValue: r.newValue, at: r.createdAt }));
}
