import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  adminNameSchema,
  businessEditSchema,
  diffOf,
  failedFields,
  newAdminSchema,
  studentEditSchema,
  universityEditSchema,
  userEditSchema,
} from "@/lib/admin-manage";
import { normalizeName, shortNameFor } from "@/lib/universities";
import { audit } from "../audit";
import { db } from "../db";
import { isUniqueViolation } from "../db-errors";
import { districtFromAddress } from "../business/registration";

/**
 * Admin boshqaruvi: o'z ismi, yangi admin, foydalanuvchi va biznes ma'lumotlarini tahrirlash, universitetlar ro'yxati.
 * Har bir amal AuditLog'ga yoziladi (o'zgargan maydonlar: oldin → keyin). Chaqiruvchi allaqachon `requireRole("ADMIN")` qilgan.
 */

export type ManageResult = { ok: true; id?: string } | { ok: false; fields?: string[]; error?: "notFound" | "phoneInUse" | "tinInUse" | "cardInUse" | "nameInUse" | "hasStudents" | "protected" };

type Tx = Prisma.TransactionClient;

// ───────── admin: o'z ismi, yangi admin ─────────

export async function updateOwnName(adminId: string, raw: unknown): Promise<ManageResult> {
  const parsed = adminNameSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fields: failedFields(parsed.error) };
  await db.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id: adminId }, select: { firstName: true, lastName: true } });
    await tx.user.update({ where: { id: adminId }, data: parsed.data });
    await audit({ actorId: adminId, action: "admin.profile.update", entity: "User", entityId: adminId, meta: { changed: diffOf(before, parsed.data) as Prisma.InputJsonObject } }, tx);
  });
  return { ok: true };
}

/**
 * Yangi admin: raqam hali ro'yxatda bo'lmasligi kerak (bitta raqam — bitta rol). Kirish: SMS kod + umumiy admin paroli
 * (`ADMIN_PASSWORD_HASH`) — alohida parol yo'q.
 */
export async function createAdmin(actorId: string, raw: unknown): Promise<ManageResult> {
  const parsed = newAdminSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fields: failedFields(parsed.error) };
  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { ...parsed.data, role: "ADMIN" }, select: { id: true } });
      await audit({ actorId, action: "admin.create", entity: "User", entityId: created.id, meta: { phone: parsed.data.phone } }, tx);
      return { ok: true as const, id: created.id };
    });
  } catch (error) {
    if (isUniqueViolation(error, "phone")) return { ok: false, error: "phoneInUse", fields: ["phone"] };
    throw error;
  }
}

// ───────── foydalanuvchi va biznes ─────────

/**
 * Talaba / biznes egasi / kassir: ism, familiya, telefon (+ talabada profil maydonlari). Telefon o'zgarsa — shu odamning
 * barcha sessiyalari yopiladi (eski raqam bilan kirgan qurilma qolmasin).
 */
export async function editUser(actorId: string, userId: string, raw: Record<string, unknown>): Promise<ManageResult> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, firstName: true, lastName: true, phone: true, student: true } });
  if (!user) return { ok: false, error: "notFound" };
  if (user.role === "ADMIN") return { ok: false, error: "protected" };

  const base = userEditSchema.safeParse(raw);
  const student = user.role === "STUDENT" ? studentEditSchema.safeParse(raw) : null;
  const fields = [...(base.success ? [] : failedFields(base.error)), ...(student && !student.success ? failedFields(student.error) : [])];
  if (!base.success || (student && !student.success) || fields.length) return { ok: false, fields };

  try {
    await db.$transaction(async (tx) => {
      const changed: Record<string, unknown> = { ...diffOf(user, base.data) };
      await tx.user.update({ where: { id: userId }, data: base.data });
      if (base.data.phone !== user.phone) await tx.session.deleteMany({ where: { userId } });
      if (student?.success && user.student) {
        const university = await tx.university.findUnique({ where: { id: student.data.universityId }, select: { id: true, kind: true } });
        if (!university) throw new FieldError("universityId");
        if (student.data.districtId && !(await tx.district.findUnique({ where: { id: student.data.districtId }, select: { id: true } }))) throw new FieldError("districtId");
        const data = { ...student.data, cardExpiresAt: student.data.cardExpiresAt ? new Date(`${student.data.cardExpiresAt}T00:00:00Z`) : null };
        Object.assign(changed, diffOf(user.student, student.data));
        await tx.studentProfile.update({ where: { userId }, data });
      }
      await audit({ actorId, action: "user.edit", entity: "User", entityId: userId, meta: { role: user.role, changed: changed as Prisma.InputJsonObject } }, tx);
    });
  } catch (error) {
    if (error instanceof FieldError) return { ok: false, fields: [error.field] };
    if (isUniqueViolation(error, "phone")) return { ok: false, error: "phoneInUse", fields: ["phone"] };
    if (isUniqueViolation(error, "cardNumber")) return { ok: false, error: "cardInUse", fields: ["cardNumber"] };
    throw error;
  }
  return { ok: true };
}

class FieldError extends Error {
  constructor(readonly field: string) {
    super(field);
  }
}

/** Biznes ma'lumotlari (admin): holat o'zgarmaydi, qayta tekshiruv yo'q. Manzil o'zgarsa tuman qayta aniqlanadi. */
export async function editBusiness(actorId: string, businessId: string, raw: Record<string, unknown>): Promise<ManageResult> {
  const parsed = businessEditSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fields: failedFields(parsed.error) };
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) return { ok: false, error: "notFound" };
  const { publicPhone, ...rest } = parsed.data;
  const districtId = rest.address !== business.address ? await districtFromAddress(rest.address) : business.districtId;
  try {
    await db.$transaction(async (tx) => {
      const changed = diffOf({ ...business, publicPhone: business.publicPhone }, { ...rest, publicPhone });
      await tx.business.update({ where: { id: businessId }, data: { ...rest, publicPhone, districtId } });
      await audit({ actorId, action: "business.edit.admin", entity: "Business", entityId: businessId, meta: { changed: changed as Prisma.InputJsonObject } }, tx);
    });
  } catch (error) {
    if (isUniqueViolation(error, "tin")) return { ok: false, error: "tinInUse", fields: ["tin"] };
    throw error;
  }
  return { ok: true };
}

// ───────── universitetlar ─────────

export async function saveUniversity(actorId: string, id: string | null, raw: unknown): Promise<ManageResult> {
  const checked = universityEditSchema.safeParse(raw);
  if (!checked.success) return { ok: false, fields: failedFields(checked.error) };
  const parsed = { success: true as const, data: { ...checked.data, shortName: checked.data.shortName || shortNameFor(checked.data.name).slice(0, 24) } };
  const clash = (await db.university.findMany({ select: { id: true, name: true } })).find((u) => normalizeName(u.name) === normalizeName(parsed.data.name) && u.id !== id);
  if (clash) return { ok: false, error: "nameInUse", fields: ["name"] };
  try {
    return await db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.university.findUnique({ where: { id } });
        if (!before) return { ok: false as const, error: "notFound" as const };
        if (before.kind === "OTHER") return { ok: false as const, error: "protected" as const };
        await tx.university.update({ where: { id }, data: { ...parsed.data, source: before.source ?? "admin" } });
        await audit({ actorId, action: "university.update", entity: "University", entityId: id, meta: { changed: diffOf(before, parsed.data) as Prisma.InputJsonObject } }, tx);
        return { ok: true as const, id };
      }
      const created = await tx.university.create({ data: { ...parsed.data, source: "admin" }, select: { id: true } });
      await audit({ actorId, action: "university.create", entity: "University", entityId: created.id, meta: { name: parsed.data.name, region: parsed.data.region } }, tx);
      return { ok: true as const, id: created.id };
    });
  } catch (error) {
    if (isUniqueViolation(error, "name")) return { ok: false, error: "nameInUse", fields: ["name"] };
    throw error;
  }
}

/** O'chirish: faqat talabasi yo'q yozuv; aks holda "faol emas" qilinadi (ro'yxatda ko'rinmaydi, talabalar saqlanadi). */
export async function deleteUniversity(actorId: string, id: string): Promise<ManageResult> {
  return db.$transaction(async (tx) => {
    const university = await tx.university.findUnique({ where: { id }, select: { name: true, kind: true, _count: { select: { students: true } } } });
    if (!university) return { ok: false, error: "notFound" };
    if (university.kind === "OTHER") return { ok: false, error: "protected" };
    if (university._count.students > 0) return { ok: false, error: "hasStudents" };
    await tx.university.delete({ where: { id } });
    await audit({ actorId, action: "university.delete", entity: "University", entityId: id, meta: { name: university.name } }, tx);
    return { ok: true };
  });
}

/** "Ro'yxatda yo'q" so'rovini yopadi: talabalarni `universityId` ga biriktiradi (faqat hali tizim yozuvida turganlarni). */
async function resolveRequests(tx: Tx, actorId: string, requestIds: string[], universityId: string) {
  const requests = await tx.universityRequest.findMany({ where: { id: { in: requestIds }, status: "PENDING" }, select: { id: true, userId: true } });
  const placeholder = await tx.university.findFirst({ where: { kind: "OTHER" }, select: { id: true } });
  for (const r of requests) {
    await tx.studentProfile.updateMany({ where: { userId: r.userId, universityId: placeholder?.id }, data: { universityId } });
    await tx.universityRequest.update({ where: { id: r.id }, data: { status: "RESOLVED", universityId, resolvedById: actorId, resolvedAt: new Date() } });
    await audit({ actorId, action: "university.request.resolve", entity: "UniversityRequest", entityId: r.id, meta: { universityId, userId: r.userId } }, tx);
  }
  return requests.length;
}

/** So'rovni mavjud universitetga biriktirish (yoki yangisini qo'shib: `create` berilsa). Nomi bir xil boshqa so'rovlar ham yopiladi. */
export async function resolveUniversityRequest(actorId: string, requestId: string, target: { universityId: string } | { create: unknown }): Promise<ManageResult> {
  const request = await db.universityRequest.findFirst({ where: { id: requestId, status: "PENDING" }, select: { id: true, name: true } });
  if (!request) return { ok: false, error: "notFound" };
  let universityId: string;
  if ("create" in target) {
    const created = await saveUniversity(actorId, null, target.create);
    if (!created.ok) return created;
    universityId = created.id!;
  } else {
    if (!(await db.university.findFirst({ where: { id: target.universityId, kind: { not: "OTHER" } }, select: { id: true } }))) return { ok: false, error: "notFound", fields: ["universityId"] };
    universityId = target.universityId;
  }
  await db.$transaction(async (tx) => {
    const same = (await tx.universityRequest.findMany({ where: { status: "PENDING" }, select: { id: true, name: true } })).filter((r) => normalizeName(r.name) === normalizeName(request.name));
    await resolveRequests(tx, actorId, [...new Set([request.id, ...same.map((r) => r.id)])], universityId);
  });
  return { ok: true, id: universityId };
}

export async function rejectUniversityRequest(actorId: string, requestId: string): Promise<ManageResult> {
  return db.$transaction(async (tx) => {
    const done = await tx.universityRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "REJECTED", resolvedById: actorId, resolvedAt: new Date() } });
    if (done.count === 0) return { ok: false, error: "notFound" };
    await audit({ actorId, action: "university.request.reject", entity: "UniversityRequest", entityId: requestId }, tx);
    return { ok: true };
  });
}
