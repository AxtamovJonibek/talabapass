import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, Role } from "@/generated/prisma/client";
import { validateDiscount, type DiscountField, type DiscountProblem } from "@/lib/discount";
import { normalizePhone } from "@/lib/format";
import { isValidPassword, PASSWORD_MAX } from "@/lib/password";
import { permissionsFrom, permissionsInput, type BusinessPermissionSet } from "@/lib/permissions";
import { deleteOwnAccount } from "../account";
import { audit } from "../audit";
import { changeBusiness, logBusinessChange } from "../business/change";
import { discountDraftSchema, discountForAdmin } from "../business/discounts";
import { db } from "../db";
import { isUniqueViolation } from "../db-errors";
import { hashPassword } from "../auth/password";
import { blockUser, unblockUser } from "../moderation";
import { storage } from "../storage";
import { checkUpload } from "../storage/file-rules";
import { sanitizeDocument, UnreadableFileError } from "../storage/sanitize";

/*
 * Super admin: foydalanuvchi hisobi (kirish usullari, sessiyalar, parol, rol, yaratish/o'chirish), biznes ruxsatlari,
 * logotip va fotolar, chegirmalarni to'liq tahrirlash/to'xtatish/o'chirish. Har amal `AuditLog` da (kim, qachon, nima,
 * oldin → keyin). Chaqiruvchi (server action, API) allaqachon `requireRole("ADMIN")` qilgan. Admin hisobi bu yerda o'zgarmaydi.
 */

export type SuperResult = { ok: true; id?: string } | { ok: false; error: SuperError; fields?: string[] };
export type SuperError = "notFound" | "protected" | "invalid" | "phoneInUse" | "emailInUse" | "hasRoleData" | "openOrders" | "badFile" | "hasHistory";

const SESSION_LIMIT = 20;
const LOGIN_HISTORY = 15;
const now = () => new Date();

/** JSON bilan solishtiriladigan oldin → keyin farqi (massivlar ham) */
function changes(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const norm = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null));
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of Object.keys(after)) {
    const a = norm(before[key]);
    const b = norm(after[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = [a, b];
  }
  return out;
}

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

async function editableUser(userId: string): Promise<{ error: "notFound" | "protected" } | { user: { id: string; role: Role } }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) return { error: "notFound" };
  if (user.role === "ADMIN") return { error: "protected" };
  return { user };
}

// ───────── hisob ma'lumoti ─────────

/**
 * Foydalanuvchining kirish ma'lumoti: usullari (parol, telefon, Google/Apple), parol vaqtlari, oxirgi kirishlar
 * (muvaffaqiyatli va xato), faol sessiyalar. Parolning o'zi va xeshi hech qachon qaytarilmaydi.
 */
export async function userAccount(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      email: true,
      passwordHash: true,
      passwordSetAt: true,
      passwordChangedAt: true,
      passwordResetRequired: true,
      passwordLockedUntil: true,
      lastLoginAt: true,
      identities: { select: { provider: true, email: true, lastUsedAt: true } },
    },
  });
  if (!user) return null;
  const [logins, sessions] = await Promise.all([
    db.auditLog.findMany({
      where: { entity: "User", entityId: userId, action: { in: ["user.login.ok", "user.login.fail"] } },
      orderBy: { createdAt: "desc" },
      take: LOGIN_HISTORY,
      select: { id: true, action: true, createdAt: true, meta: true },
    }),
    db.session.findMany({
      where: { userId, expiresAt: { gt: now() } },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
      take: SESSION_LIMIT,
      select: { id: true, kind: true, deviceName: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    }),
  ]);
  const { passwordHash, identities, ...rest } = user;
  return {
    ...rest,
    hasPassword: passwordHash !== null,
    methods: [...(passwordHash ? ["password" as const] : []), ...(user.phone && !user.phone.startsWith("deleted:") ? ["phone" as const] : []), ...identities.map((i) => i.provider.toLowerCase() as "google" | "apple")],
    identities,
    logins: logins.map((l) => {
      const meta = (l.meta ?? {}) as { method?: string; via?: string; device?: string; ua?: string };
      return { id: l.id, ok: l.action === "user.login.ok", at: l.createdAt, method: meta.method ?? null, via: meta.via ?? null, device: meta.device ?? meta.ua ?? null };
    }),
    sessions,
  };
}

// ───────── amallar ─────────

/** Barcha (yoki bitta) sessiyani yopish — qurilmalar darhol chiqariladi. */
export async function closeSessions(actorId: string, userId: string, sessionId?: string): Promise<SuperResult> {
  const found = await editableUser(userId);
  if ("error" in found) return { ok: false, error: found.error };
  await db.$transaction(async (tx) => {
    const closed = await tx.session.deleteMany({ where: { userId, ...(sessionId ? { id: sessionId } : {}) } });
    await audit({ actorId, action: "user.sessions.close", entity: "User", entityId: userId, meta: { count: closed.count, ...(sessionId ? { sessionId } : {}) } }, tx);
  });
  return { ok: true };
}

/**
 * "Parolni tiklash": keyingi kirishda yangi parol majburiy (`passwordResetRequired`, `requireRole` → `/kirish/parol`), barcha
 * sessiyalar yopiladi. Parolni admin bilmaydi va o'rnatmaydi.
 */
export async function requirePasswordReset(actorId: string, userId: string): Promise<SuperResult> {
  const found = await editableUser(userId);
  if ("error" in found) return { ok: false, error: found.error };
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordResetRequired: true } });
    const closed = await tx.session.deleteMany({ where: { userId } });
    await audit({ actorId, action: "user.password.reset_required", entity: "User", entityId: userId, meta: { sessionsClosed: closed.count } }, tx);
  });
  return { ok: true };
}

const ROLES_EDITABLE = ["STUDENT", "BUSINESS_OWNER", "CASHIER"] as const satisfies readonly Role[];

/**
 * Rolni almashtirish: faqat rolga bog'liq ma'lumoti yo'q hisobda (talaba profili, biznes, kassir a'zoligi) — aks holda
 * ma'lumot "osilib" qoladi (`hasRoleData`). Sessiyalar yopiladi (yangi rol bilan qaytadan kiradi).
 */
export async function changeRole(actorId: string, userId: string, roleRaw: unknown): Promise<SuperResult> {
  const role = z.enum(ROLES_EDITABLE).safeParse(roleRaw);
  if (!role.success) return { ok: false, error: "invalid", fields: ["role"] };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, student: { select: { userId: true } }, _count: { select: { ownedBusinesses: true, memberships: true } } },
  });
  if (!user) return { ok: false, error: "notFound" };
  if (user.role === "ADMIN") return { ok: false, error: "protected" };
  if (user.role === role.data) return { ok: true };
  if (user.student || user._count.ownedBusinesses > 0 || user._count.memberships > 0) return { ok: false, error: "hasRoleData" };
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role: role.data } });
    await tx.session.deleteMany({ where: { userId } });
    await audit({ actorId, action: "user.role", entity: "User", entityId: userId, meta: { changed: { role: [user.role, role.data] } } }, tx);
  });
  return { ok: true };
}

export const newUserSchema = z
  .object({
    role: z.enum(ROLES_EDITABLE),
    firstName: z.string().trim().min(2).max(40),
    lastName: z.string().trim().max(40),
    phone: z.string().trim().max(32),
    email: z.string().trim().max(120),
    password: z.string().max(PASSWORD_MAX * 2).refine(isValidPassword),
  })
  .refine((v) => v.phone !== "" || v.email !== "", { message: "contact", path: ["phone"] });

/**
 * Yangi foydalanuvchi (admin): ism, raqam va/yoki email, rol va majburiy parol (qoidalari ro'yxatdagi bilan bir xil).
 * Talaba ro'yxat formasidan (OTM, guvohnoma) o'tadi.
 */
export async function createUser(actorId: string, raw: unknown): Promise<SuperResult> {
  const parsed = newUserSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const v = parsed.data;
  const phone = v.phone ? normalizePhone(v.phone) : null;
  if (v.phone && !phone) return { ok: false, error: "invalid", fields: ["phone"] };
  const email = v.email ? v.email.toLowerCase() : null;
  if (email && !z.string().email().safeParse(email).success) return { ok: false, error: "invalid", fields: ["email"] };
  try {
    const user = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { role: v.role, firstName: v.firstName, lastName: v.lastName || null, phone, email, passwordHash: hashPassword(v.password), passwordSetAt: new Date() }, select: { id: true } });
      await audit({ actorId, action: "user.create", entity: "User", entityId: user.id, meta: { role: v.role, phone, email } }, tx);
      return user;
    });
    return { ok: true, id: user.id };
  } catch (error) {
    if (isUniqueViolation(error, "phone")) return { ok: false, error: "phoneInUse", fields: ["phone"] };
    if (isUniqueViolation(error, "email")) return { ok: false, error: "emailInUse", fields: ["email"] };
    throw error;
  }
}

/** Hisobni o'chirish — foydalanuvchining o'zi o'chirgandagidek (`deleteOwnAccount`: tarix qoladi, shaxsiy ma'lumot tozalanadi). */
export async function deleteUser(actorId: string, userId: string): Promise<SuperResult> {
  const found = await editableUser(userId);
  if ("error" in found) return { ok: false, error: found.error };
  const result = await deleteOwnAccount(userId);
  if (!result.ok) return { ok: false, error: result.problem === "open_orders" ? "openOrders" : "protected" };
  await audit({ actorId, action: "user.delete.admin", entity: "User", entityId: userId, meta: { role: found.user.role } });
  return { ok: true };
}

/** Bloklash / blokdan chiqarish — faqat `moderation.ts` orqali (sessiyalar bilan birga); admin hisobi bloklanmaydi. */
export async function setUserBlocked(actorId: string, userId: string, blocked: boolean, reason: string): Promise<SuperResult> {
  const found = await editableUser(userId);
  if ("error" in found) return { ok: false, error: found.error };
  if (blocked) {
    if (reason.trim().length < 3) return { ok: false, error: "invalid", fields: ["reason"] };
    await blockUser(userId, reason.trim(), actorId);
    return { ok: true };
  }
  return (await unblockUser(userId, actorId)) ? { ok: true } : { ok: false, error: "invalid" };
}

// ───────── biznes ruxsatlari ─────────

export async function businessPermissions(businessId: string): Promise<BusinessPermissionSet> {
  return permissionsFrom(await db.businessPermissions.findUnique({ where: { businessId } }));
}

/** Ruxsatlarni saqlash (oldin → keyin auditda). Panel va API keyingi so'rovdanoq yangisini qo'llaydi. */
export async function setBusinessPermissions(actorId: string, businessId: string, raw: unknown): Promise<SuperResult> {
  const parsed = permissionsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  if (!(await db.business.findUnique({ where: { id: businessId }, select: { id: true } }))) return { ok: false, error: "notFound" };
  const before = await businessPermissions(businessId);
  const changed = changes(before, parsed.data);
  if (Object.keys(changed).length === 0) return { ok: true };
  await db.$transaction(async (tx) => {
    await tx.businessPermissions.upsert({ where: { businessId }, create: { businessId, ...parsed.data }, update: parsed.data });
    await audit({ actorId, action: "business.permissions", entity: "Business", entityId: businessId, meta: { changed: asJson(changed) } }, tx);
  });
  return { ok: true };
}

// ───────── logotip va fotolar ─────────

const PHOTOS_MAX = 3;

async function cleanImage(bytes: Uint8Array) {
  const checked = checkUpload(bytes);
  if (!checked.ok || checked.type.ext === "pdf") return null;
  try {
    return await sanitizeDocument(bytes, checked.type);
  } catch (error) {
    if (error instanceof UnreadableFileError) return null;
    throw error;
  }
}

/** Admin biznes logotipini almashtiradi (egasining ruxsatidan qat'i nazar). Fayl tozalanadi, eski fayl o'chiriladi. */
export async function setLogoByAdmin(actorId: string, businessId: string, bytes: Uint8Array): Promise<SuperResult> {
  const business = await db.business.findUnique({ where: { id: businessId }, select: { logoKey: true } });
  if (!business) return { ok: false, error: "notFound" };
  const clean = await cleanImage(bytes);
  if (!clean) return { ok: false, error: "badFile" };
  const key = `business/${businessId}/logo-${randomUUID()}.${clean.ext}`;
  await storage().put(key, clean.bytes);
  await db.$transaction(async (tx) => {
    await changeBusiness({ actor: { id: actorId, role: "ADMIN" }, businessId, changes: { logoKey: key } }, tx);
    await audit({ actorId, action: "business.logo.admin", entity: "Business", entityId: businessId }, tx);
  });
  if (business.logoKey) await storage().delete(business.logoKey).catch(() => undefined);
  return { ok: true };
}

export async function removeLogoByAdmin(actorId: string, businessId: string): Promise<SuperResult> {
  const business = await db.business.findUnique({ where: { id: businessId }, select: { logoKey: true } });
  if (!business) return { ok: false, error: "notFound" };
  if (!business.logoKey) return { ok: true };
  await db.$transaction(async (tx) => {
    await changeBusiness({ actor: { id: actorId, role: "ADMIN" }, businessId, changes: { logoKey: null } }, tx);
    await audit({ actorId, action: "business.logo.remove.admin", entity: "Business", entityId: businessId }, tx);
  });
  await storage().delete(business.logoKey).catch(() => undefined);
  return { ok: true };
}

/** Joy fotosi qo'shish (3 tagacha) */
export async function addPhotoByAdmin(actorId: string, businessId: string, bytes: Uint8Array, fileName: string): Promise<SuperResult> {
  const business = await db.business.findUnique({ where: { id: businessId }, select: { _count: { select: { docs: { where: { kind: "PHOTO" } } } } } });
  if (!business) return { ok: false, error: "notFound" };
  if (business._count.docs >= PHOTOS_MAX) return { ok: false, error: "invalid", fields: ["photos"] };
  const clean = await cleanImage(bytes);
  if (!clean) return { ok: false, error: "badFile" };
  const key = `business/${businessId}/photo-${randomUUID()}.${clean.ext}`;
  await storage().put(key, clean.bytes);
  const doc = await db.$transaction(async (tx) => {
    const doc = await tx.businessDoc.create({ data: { businessId, kind: "PHOTO", fileKey: key, fileName: fileName.slice(0, 120) || `photo.${clean.ext}` }, select: { id: true } });
    await logBusinessChange(tx, { businessId, actor: { id: actorId, role: "ADMIN" }, field: "photos", oldValue: null, newValue: "foto qo'shildi" });
    await audit({ actorId, action: "business.photo.add.admin", entity: "Business", entityId: businessId, meta: { docId: doc.id } }, tx);
    return doc;
  });
  return { ok: true, id: doc.id };
}

export async function removePhotoByAdmin(actorId: string, docId: string): Promise<SuperResult> {
  const doc = await db.businessDoc.findFirst({ where: { id: docId, kind: "PHOTO" }, select: { id: true, businessId: true, fileKey: true } });
  if (!doc) return { ok: false, error: "notFound" };
  await db.$transaction(async (tx) => {
    await tx.businessDoc.delete({ where: { id: doc.id } });
    await logBusinessChange(tx, { businessId: doc.businessId, actor: { id: actorId, role: "ADMIN" }, field: "photos", oldValue: "foto", newValue: null });
    await audit({ actorId, action: "business.photo.remove.admin", entity: "Business", entityId: doc.businessId, meta: { docId } }, tx);
  });
  await storage().delete(doc.fileKey).catch(() => undefined);
  return { ok: true };
}

// ───────── chegirmalar ─────────

export type AdminDiscountResult = SuperResult | { ok: false; error: "errors"; errors: Partial<Record<DiscountField, DiscountProblem>> };

/**
 * Admin chegirmani to'liq tahrirlaydi: holat o'zgarmaydi va qayta tekshiruv yo'q (admin o'zi tekshiruvchi). Qoidalar
 * egasiniki bilan bir xil (`validateDiscount`, boshlanish sanasi o'tmishda qolishi mumkin). Oldin → keyin auditda.
 */
export async function saveDiscountByAdmin(actorId: string, discountId: string, raw: unknown): Promise<AdminDiscountResult> {
  const parsed = discountDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const existing = await discountForAdmin(discountId);
  if (!existing) return { ok: false, error: "notFound" };
  const draft = { ...parsed.data, title: parsed.data.title.trim(), terms: parsed.data.terms.trim(), percent: parsed.data.type === "PERCENT" ? parsed.data.percent : null, newPrice: parsed.data.type === "FIXED_PRICE" ? parsed.data.newPrice : null };
  const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
  const errors = validateDiscount(draft, today);
  if (errors.dates === "startInPast") delete errors.dates;
  if (Object.keys(errors).length > 0) return { ok: false, error: "errors", errors };
  const changed = changes(existing.draft, draft);
  if (Object.keys(changed).length === 0) return { ok: true };
  await db.$transaction(async (tx) => {
    await tx.discount.update({
      where: { id: discountId },
      data: {
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
        startsOn: new Date(`${draft.startsOn}T00:00:00Z`),
        endsOn: new Date(`${draft.endsOn}T00:00:00Z`),
        terms: draft.terms || null,
      },
    });
    await audit({ actorId, action: "discount.edit.admin", entity: "Discount", entityId: discountId, meta: { changed: asJson(changed) } }, tx);
  });
  return { ok: true };
}

/** To'xtatish / yoqish (faqat ACTIVE ↔ PAUSED; admin faollar chegarasiga bog'lanmaydi). */
export async function setDiscountStatusByAdmin(actorId: string, discountId: string, active: boolean): Promise<SuperResult> {
  const updated = await db.$transaction(async (tx) => {
    const r = await tx.discount.updateMany({ where: { id: discountId, status: active ? "PAUSED" : "ACTIVE" }, data: { status: active ? "ACTIVE" : "PAUSED" } });
    if (r.count === 1) await audit({ actorId, action: active ? "discount.resume.admin" : "discount.pause.admin", entity: "Discount", entityId: discountId }, tx);
    return r.count;
  });
  return updated === 1 ? { ok: true } : { ok: false, error: "invalid" };
}

/**
 * O'chirish: tarixi yo'q (kupon, sotuv, buyurtma bo'lmagan) chegirma butunlay o'chadi (rasmlari bilan); tarixi bor
 * chegirma o'chirilmaydi — hisobotlar buzilmasin — `ENDED` qilinadi (`hasHistory`, talabaga ko'rinmaydi).
 */
export async function deleteDiscountByAdmin(actorId: string, discountId: string): Promise<SuperResult> {
  const discount = await db.discount.findUnique({
    where: { id: discountId },
    select: { id: true, title: true, status: true, businessId: true, images: { select: { fileKey: true } }, _count: { select: { coupons: true, orders: true, redemptions: true } } },
  });
  if (!discount) return { ok: false, error: "notFound" };
  if (discount._count.coupons > 0 || discount._count.orders > 0 || discount._count.redemptions > 0) {
    await db.$transaction(async (tx) => {
      await tx.discount.update({ where: { id: discountId }, data: { status: "ENDED" } });
      await audit({ actorId, action: "discount.end.admin", entity: "Discount", entityId: discountId, meta: { from: discount.status, title: discount.title } }, tx);
    });
    return { ok: false, error: "hasHistory" };
  }
  await db.$transaction(async (tx) => {
    await tx.discountImage.deleteMany({ where: { discountId } });
    await tx.discountDay.deleteMany({ where: { discountId } });
    await tx.discountView.deleteMany({ where: { discountId } });
    await tx.savedDiscount.deleteMany({ where: { discountId } });
    await tx.bookingSeat.deleteMany({ where: { discountId } });
    await tx.discount.delete({ where: { id: discountId } });
    await audit({ actorId, action: "discount.delete.admin", entity: "Discount", entityId: discountId, meta: { title: discount.title, businessId: discount.businessId, status: discount.status } }, tx);
  });
  await Promise.all(discount.images.map((i) => storage().delete(i.fileKey).catch(() => undefined)));
  return { ok: true };
}

// ───────── jurnal ─────────

export const JOURNAL_PAGE = 50;
export const JOURNAL_GROUPS = ["user", "student", "business", "discount", "cashier", "preorder", "order", "admin", "landing", "transactions", "file", "university", "notification"] as const;

export type JournalFilter = { q: string; group: string; actor: string; entity: string; entityId: string; from: string; to: string; page: number };

/**
 * Faoliyat jurnali (`AuditLog`): amal guruhi (`user.*`, `business.*` …), bajaruvchi (ism yoki raqam), obyekt turi/id,
 * sana oralig'i (Toshkent kuni), erkin qidiruv (amal nomi yoki obyekt id). Eng yangisi tepada.
 */
export async function journal(f: JournalFilter) {
  const day = (iso: string, end = false) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(new Date(`${iso}T00:00:00Z`).getTime() - 5 * 3_600_000 + (end ? 86_400_000 : 0)) : null);
  const from = day(f.from);
  const to = day(f.to, true);
  const actorTerm = f.actor.trim();
  const where: Prisma.AuditLogWhereInput = {
    ...((JOURNAL_GROUPS as readonly string[]).includes(f.group) ? { action: { startsWith: `${f.group}.` } } : {}),
    ...(f.entity ? { entity: f.entity } : {}),
    ...(f.entityId ? { entityId: f.entityId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(actorTerm
      ? {
          actor: {
            OR: [
              { phone: { contains: actorTerm.replace(/\s/g, "") } },
              { firstName: { contains: actorTerm, mode: "insensitive" } },
              { lastName: { contains: actorTerm, mode: "insensitive" } },
              { email: { contains: actorTerm, mode: "insensitive" } },
            ],
          },
        }
      : {}),
    ...(f.q.trim() ? { OR: [{ action: { contains: f.q.trim() } }, { entityId: f.q.trim() }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, f.page) - 1) * JOURNAL_PAGE,
      take: JOURNAL_PAGE,
      select: { id: true, action: true, entity: true, entityId: true, meta: true, createdAt: true, actor: { select: { id: true, firstName: true, lastName: true, role: true, phone: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total };
}

/** Bitta foydalanuvchi yoki biznes bo'yicha jurnal: u bajargan va u haqidagi yozuvlar */
export function entityJournal(kind: "User" | "Business", id: string, take = 30) {
  return db.auditLog.findMany({
    where: kind === "User" ? { OR: [{ actorId: id }, { entity: "User", entityId: id }] } : { entity: "Business", entityId: id },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, action: true, entity: true, entityId: true, meta: true, createdAt: true, actor: { select: { firstName: true, lastName: true, role: true } } },
  });
}

// ───────── hamkorlar boshqaruvi: ro'yxat va tafsilot ─────────

export const PARTNERS_PAGE = 25;
const BUSINESS_STATUSES = ["APPROVED", "WARNED", "PENDING", "REJECTED", "BLOCKED"] as const;

/** Barcha bizneslar: nom, STIR yoki manzil bo'yicha qidiruv, holat filtri, sahifalar */
export async function listBusinesses({ q, status, page }: { q: string; status: string; page: number }) {
  const term = q.trim();
  const where: Prisma.BusinessWhereInput = {
    ...((BUSINESS_STATUSES as readonly string[]).includes(status) ? { status: status as (typeof BUSINESS_STATUSES)[number] } : {}),
    ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { tin: { contains: term } }, { address: { contains: term, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * PARTNERS_PAGE,
      take: PARTNERS_PAGE,
      select: { id: true, name: true, status: true, kind: true, owner: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    }),
    db.business.count({ where }),
  ]);
  return { rows, total };
}

/** Biznes tafsiloti: ega, logotip, fotolar, chegirmalar (admin tahriri uchun to'liq maydonlar) */
export async function businessAdminDetail(businessId: string) {
  return db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      status: true,
      rejectReason: true,
      logoKey: true,
      owner: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, role: true } },
      docs: { where: { kind: "PHOTO" }, orderBy: { createdAt: "asc" }, select: { id: true, fileName: true } },
      discounts: {
        orderBy: { createdAt: "desc" },
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
        },
      },
    },
  });
}
