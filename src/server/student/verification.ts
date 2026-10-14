import "server-only";
import { randomUUID } from "node:crypto";
import { canUploadCard, effectiveStudentStatus } from "../auth/student-status";
import { db } from "../db";
import { storage } from "../storage";
import { checkUpload, safeFileName, type UploadProblem } from "../storage/file-rules";

/** Bir talaba bir kunda yuklay oladigan fayllar soni (omborni to'ldirishga qarshi). */
export const DAILY_UPLOAD_LIMIT = 10;
export const SUPERSEDED_REASON = "Talaba yangi fayl yukladi";

export type SubmitProblem = UploadProblem | "not_allowed" | "daily_limit";
export type SubmitResult = { ok: true; verificationId: string } | { ok: false; problem: SubmitProblem };

/**
 * Talaba guvohnomasini qabul qiladi: mazmunini tekshiradi, private omborga yozadi, tekshiruv navbatiga qo'yadi.
 * Kutib turgan oldingi yuklash bo'lsa — u yopiladi va fayli o'chiriladi (moderator faqat oxirgisini ko'radi).
 */
export async function submitStudentCard(userId: string, bytes: Uint8Array, originalName: string): Promise<SubmitResult> {
  const profile = await db.studentProfile.findUnique({ where: { userId }, select: { status: true, cardExpiresAt: true } });
  if (!profile || !canUploadCard(effectiveStudentStatus(profile.status, profile.cardExpiresAt, new Date()))) {
    return { ok: false, problem: "not_allowed" };
  }

  const checked = checkUpload(bytes);
  if (!checked.ok) return checked;

  const recent = await db.verification.count({ where: { studentId: userId, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (recent >= DAILY_UPLOAD_LIMIT) return { ok: false, problem: "daily_limit" };

  // Kalit faqat o'zimiz yaratgan qismlardan: foydalanuvchi bergan nom yo'lga kirmaydi.
  const fileKey = `verifications/${userId}/${randomUUID()}.${checked.type.ext}`;
  await storage().put(fileKey, bytes);

  try {
    const { created, superseded } = await db.$transaction(async (tx) => {
      const superseded = await tx.verification.findMany({ where: { studentId: userId, status: "PENDING" }, select: { id: true, fileKey: true } });
      await tx.verification.updateMany({
        where: { id: { in: superseded.map((v) => v.id) } },
        data: { status: "REJECTED", rejectReason: SUPERSEDED_REASON, reviewedAt: new Date() },
      });
      const created = await tx.verification.create({
        data: {
          studentId: userId,
          fileKey,
          fileName: safeFileName(originalName, `guvohnoma.${checked.type.ext}`),
          fileSize: bytes.byteLength,
          mime: checked.type.mime,
        },
        select: { id: true },
      });
      await tx.studentProfile.update({ where: { userId }, data: { status: "PENDING" } });
      return { created, superseded };
    });
    // Eski fayllar tranzaksiya muvaffaqiyatli tugagandan keyingina o'chiriladi.
    await Promise.all(superseded.map((v) => storage().delete(v.fileKey).catch(() => undefined)));
    return { ok: true, verificationId: created.id };
  } catch (error) {
    await storage().delete(fileKey).catch(() => undefined);
    throw error;
  }
}

/** Tekshiruv sahifasi uchun: oxirgi yuklash va navbatdagi o'rni. */
export async function latestVerification(userId: string) {
  const latest = await db.verification.findFirst({
    where: { studentId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, fileSize: true, status: true, rejectReason: true, createdAt: true },
  });
  if (!latest) return null;
  const ahead = latest.status === "PENDING" ? await db.verification.count({ where: { status: "PENDING", createdAt: { lt: latest.createdAt } } }) : 0;
  return { ...latest, queuePosition: ahead + 1 };
}
