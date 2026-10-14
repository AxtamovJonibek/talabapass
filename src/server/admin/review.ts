import "server-only";
import { toTashkent, fromTashkent } from "@/lib/time";
import { audit } from "../audit";
import { db } from "../db";
import { blockBusiness, blockUser } from "../moderation";
import { checkCardExpiry, normalizeCardNumber, parseDateInput } from "./review-rules";

/**
 * Admin tekshiruvi (A2): talaba guvohnomalari va biznes arizalari navbati, qarorlar.
 * Har bir funksiya chaqiruvchi allaqachon `requireRole("ADMIN")` qilgan deb hisoblaydi — `actorId` audit uchun.
 */

const QUEUE_PAGE = 30;
const startOfToday = () => fromTashkent(toTashkent(new Date()).date, 0);

// ───────── navbatlar ─────────

export async function pendingCounts() {
  const [students, businesses] = await Promise.all([
    db.verification.count({ where: { status: "PENDING" } }),
    db.business.count({ where: { status: "PENDING" } }),
  ]);
  return { students, businesses };
}

export async function studentQueue() {
  const [items, total] = await Promise.all([
    db.verification.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: QUEUE_PAGE,
      select: {
        id: true,
        createdAt: true,
        student: {
          select: {
            status: true,
            faculty: true,
            course: true,
            // Oldin tasdiqlangan (guvohnoma raqami bor) — demak bu muddat yangilash
            cardNumber: true,
            university: { select: { shortName: true } },
            user: { select: { firstName: true, lastName: true } },
            // Oldin rad etilganmi (o'zi almashtirgani hisobga olinmaydi)
            verifications: { where: { status: "REJECTED", NOT: { rejectReason: "Talaba yangi fayl yukladi" } }, select: { id: true }, take: 1 },
          },
        },
      },
    }),
    db.verification.count({ where: { status: "PENDING" } }),
  ]);
  return { items, total };
}

export async function studentDetail(verificationId: string) {
  return db.verification.findUnique({
    where: { id: verificationId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      fileName: true,
      fileSize: true,
      mime: true,
      rejectReason: true,
      student: {
        select: {
          userId: true,
          status: true,
          faculty: true,
          course: true,
          cardNumber: true,
          cardExpiresAt: true,
          university: { select: { name: true, shortName: true } },
          user: { select: { firstName: true, lastName: true, phone: true, status: true } },
        },
      },
    },
  });
}

export async function businessQueue() {
  const [items, total] = await Promise.all([
    db.business.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: QUEUE_PAGE,
      select: { id: true, name: true, kind: true, address: true, createdAt: true, docs: { select: { kind: true } }, district: { select: { name: true } } },
    }),
    db.business.count({ where: { status: "PENDING" } }),
  ]);
  return { items, total };
}

export async function businessDetail(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      legalName: true,
      tin: true,
      kind: true,
      address: true,
      workingHours: true,
      contactName: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      district: { select: { name: true } },
      owner: { select: { id: true, phone: true, status: true } },
      docs: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, fileName: true } },
      discounts: { orderBy: { createdAt: "asc" }, take: 1, select: { title: true } },
    },
  });
  if (!business) return null;
  // STIR boshqa biznesda ham bormi (unique — lekin bloklangan/rad etilgan nusxalarni ham ko'rsatish uchun)
  const tinTaken = business.tin ? (await db.business.count({ where: { tin: business.tin, NOT: { id: business.id } } })) > 0 : false;
  return { ...business, tinTaken };
}

/** Sarlavhadagi ko'rsatkichlar: bugun tasdiqlangan va oxirgi 7 kundagi o'rtacha kutish. */
export async function reviewStats(kind: "students" | "businesses") {
  const today = startOfToday();
  const week = new Date(Date.now() - 7 * 86_400_000);
  if (kind === "students") {
    const [approvedToday, reviewed] = await Promise.all([
      db.verification.count({ where: { status: "APPROVED", reviewedAt: { gte: today } } }),
      db.verification.findMany({
        where: { reviewedAt: { gte: week }, reviewedById: { not: null } },
        select: { createdAt: true, reviewedAt: true },
      }),
    ]);
    return { approvedToday, reviewed: reviewed.map((r) => ({ createdAt: r.createdAt, reviewedAt: r.reviewedAt! })) };
  }
  const [approvedToday, reviewed] = await Promise.all([
    db.business.count({ where: { status: "APPROVED", reviewedAt: { gte: today } } }),
    db.business.findMany({ where: { reviewedAt: { gte: week }, reviewedById: { not: null } }, select: { createdAt: true, reviewedAt: true } }),
  ]);
  return { approvedToday, reviewed: reviewed.map((r) => ({ createdAt: r.createdAt, reviewedAt: r.reviewedAt! })) };
}

// ───────── qarorlar: talaba ─────────

export type ApproveStudentError = "not_pending" | "card_number" | "card_duplicate" | "expiry_invalid" | "expiry_past" | "expiry_far";

export async function approveStudent(
  input: { verificationId: string; cardNumber: string; cardExpiresAt: string },
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: ApproveStudentError }> {
  const cardNumber = normalizeCardNumber(input.cardNumber);
  if (!cardNumber) return { ok: false, error: "card_number" };
  const expiresAt = parseDateInput(input.cardExpiresAt);
  if (!expiresAt) return { ok: false, error: "expiry_invalid" };
  const expiry = checkCardExpiry(expiresAt, new Date());
  if (expiry === "expired") return { ok: false, error: "expiry_past" };
  if (expiry === "too_far") return { ok: false, error: "expiry_far" };

  const verification = await db.verification.findUnique({ where: { id: input.verificationId }, select: { studentId: true } });
  if (!verification) return { ok: false, error: "not_pending" };

  // Bitta guvohnoma — bitta hisob: boshqa talabada shu raqam bo'lsa tasdiqlanmaydi.
  const holder = await db.studentProfile.findUnique({ where: { cardNumber }, select: { userId: true } });
  if (holder && holder.userId !== verification.studentId) return { ok: false, error: "card_duplicate" };

  try {
    return await db.$transaction(async (tx) => {
      const closed = await tx.verification.updateMany({
        where: { id: input.verificationId, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: actorId, reviewedAt: new Date() },
      });
      if (closed.count === 0) return { ok: false as const, error: "not_pending" as const };
      await tx.studentProfile.update({
        where: { userId: verification.studentId },
        data: { status: "APPROVED", cardNumber, cardExpiresAt: expiresAt },
      });
      await audit({ actorId, action: "student.approve", entity: "Verification", entityId: input.verificationId, meta: { cardNumber, cardExpiresAt: input.cardExpiresAt } }, tx);
      // TODO(10-bosqich): talabaga SMS va push ("Tasdiqlandi").
      return { ok: true as const };
    });
  } catch (error) {
    // Ikki admin bir vaqtda bir xil raqam bilan tasdiqlasa — unique cheklov ushlab qoladi.
    if ((error as { code?: string }).code === "P2002") return { ok: false, error: "card_duplicate" };
    throw error;
  }
}

export async function rejectStudent(
  input: { verificationId: string; reasonText: string; reasonKey: string },
  actorId: string,
): Promise<{ ok: true } | { ok: false; error: "not_pending" }> {
  return db.$transaction(async (tx) => {
    const verification = await tx.verification.findUnique({ where: { id: input.verificationId }, select: { studentId: true } });
    const closed = await tx.verification.updateMany({
      where: { id: input.verificationId, status: "PENDING" },
      data: { status: "REJECTED", rejectReason: input.reasonText, reviewedById: actorId, reviewedAt: new Date() },
    });
    if (!verification || closed.count === 0) return { ok: false as const, error: "not_pending" as const };
    await tx.studentProfile.update({ where: { userId: verification.studentId }, data: { status: "REJECTED" } });
    await audit({ actorId, action: "student.reject", entity: "Verification", entityId: input.verificationId, meta: { reason: input.reasonKey } }, tx);
    // TODO(10-bosqich): talabaga SMS va push (sababi bilan).
    return { ok: true as const };
  });
}

/** Talabani bloklash: hisob va barcha sessiyalar (moderation.blockUser), kutayotgan arizasi yopiladi. */
export async function blockStudent(input: { verificationId: string; reasonText: string; reasonKey: string }, actorId: string) {
  const verification = await db.verification.findUnique({ where: { id: input.verificationId }, select: { studentId: true } });
  if (!verification) return { ok: false as const, error: "not_pending" as const };
  await blockUser(verification.studentId, input.reasonKey, actorId);
  await db.verification.updateMany({
    where: { studentId: verification.studentId, status: "PENDING" },
    data: { status: "REJECTED", rejectReason: input.reasonText, reviewedById: actorId, reviewedAt: new Date() },
  });
  return { ok: true as const };
}

// ───────── qarorlar: biznes ─────────

export async function approveBusiness(businessId: string, actorId: string): Promise<{ ok: true } | { ok: false; error: "not_pending" }> {
  return db.$transaction(async (tx) => {
    const closed = await tx.business.updateMany({
      where: { id: businessId, status: "PENDING" },
      data: { status: "APPROVED", rejectReason: null, reviewedById: actorId, reviewedAt: new Date() },
    });
    if (closed.count === 0) return { ok: false as const, error: "not_pending" as const };
    await audit({ actorId, action: "business.approve", entity: "Business", entityId: businessId }, tx);
    return { ok: true as const };
  });
}

export async function rejectBusiness(input: { businessId: string; reasonText: string; reasonKey: string }, actorId: string) {
  return db.$transaction(async (tx) => {
    const closed = await tx.business.updateMany({
      where: { id: input.businessId, status: "PENDING" },
      data: { status: "REJECTED", rejectReason: input.reasonText, reviewedById: actorId, reviewedAt: new Date() },
    });
    if (closed.count === 0) return { ok: false as const, error: "not_pending" as const };
    await audit({ actorId, action: "business.reject", entity: "Business", entityId: input.businessId, meta: { reason: input.reasonKey } }, tx);
    return { ok: true as const };
  });
}

export async function blockBusinessFromReview(input: { businessId: string; reasonKey: string }, actorId: string) {
  const exists = await db.business.findUnique({ where: { id: input.businessId }, select: { id: true } });
  if (!exists) return { ok: false as const, error: "not_pending" as const };
  await blockBusiness(input.businessId, input.reasonKey, actorId);
  return { ok: true as const };
}

// ───────── fayllarni ko'rish (faqat admin, har biri audit'ga) ─────────

export async function verificationFile(id: string) {
  return db.verification.findUnique({ where: { id }, select: { fileKey: true, mime: true, fileName: true } });
}

export async function businessDocFile(id: string) {
  const doc = await db.businessDoc.findUnique({ where: { id }, select: { fileKey: true, fileName: true } });
  if (!doc) return null;
  const ext = doc.fileKey.split(".").pop();
  return { ...doc, mime: ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg" };
}
