import "server-only";
import { randomUUID } from "node:crypto";
import { audit } from "./audit";
import { db } from "./db";
import { storage } from "./storage";
import { checkUpload } from "./storage/file-rules";
import { sanitizeDocument, UnreadableFileError, type CleanFile } from "./storage/sanitize";

/**
 * Profil rasmlari: talaba avatari (`StudentProfile.avatarKey`) va biznes logotipi (`Business.logoKey`).
 * Mijoz kesib (crop), kattalashtirib/aylantirib kvadrat rasm yuboradi; server baribir mavjud tozalash
 * pipeline'idan o'tkazadi (qayta kodlash: EXIF/GPS qolmaydi). Fayllar private bucket'da.
 */
export type ImageProblem = "empty" | "too_large" | "bad_type" | "not_allowed" | "daily_limit";
export type ImageResult = { ok: true; key: string } | { ok: false; problem: ImageProblem };

const DAILY_LIMIT = 30;

async function clean(actorId: string, action: string, bytes: Uint8Array): Promise<{ ok: true; file: CleanFile } | { ok: false; problem: ImageProblem }> {
  const checked = checkUpload(bytes);
  if (!checked.ok) return checked;
  if (checked.type.ext === "pdf") return { ok: false, problem: "bad_type" };
  const recent = await db.auditLog.count({ where: { actorId, action, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (recent >= DAILY_LIMIT) return { ok: false, problem: "daily_limit" };
  try {
    return { ok: true, file: await sanitizeDocument(bytes, checked.type) };
  } catch (error) {
    if (error instanceof UnreadableFileError) return { ok: false, problem: "bad_type" };
    throw error;
  }
}

const dropFile = (key: string | null | undefined) => (key ? storage().delete(key).catch(() => undefined) : Promise.resolve());

export async function setStudentAvatar(userId: string, bytes: Uint8Array): Promise<ImageResult> {
  const profile = await db.studentProfile.findUnique({ where: { userId }, select: { avatarKey: true, user: { select: { status: true } } } });
  if (!profile || profile.user.status !== "ACTIVE") return { ok: false, problem: "not_allowed" };
  const result = await clean(userId, "student.avatar", bytes);
  if (!result.ok) return result;
  const key = `avatars/${userId}/${randomUUID()}.${result.file.ext}`;
  await storage().put(key, result.file.bytes);
  try {
    await db.$transaction(async (tx) => {
      await tx.studentProfile.update({ where: { userId }, data: { avatarKey: key } });
      await audit({ actorId: userId, action: "student.avatar", entity: "User", entityId: userId }, tx);
    });
  } catch (error) {
    await dropFile(key);
    throw error;
  }
  await dropFile(profile.avatarKey);
  return { ok: true, key };
}

export async function removeStudentAvatar(userId: string): Promise<boolean> {
  const profile = await db.studentProfile.findUnique({ where: { userId }, select: { avatarKey: true } });
  if (!profile?.avatarKey) return false;
  await db.$transaction(async (tx) => {
    await tx.studentProfile.update({ where: { userId }, data: { avatarKey: null } });
    await audit({ actorId: userId, action: "student.avatar.remove", entity: "User", entityId: userId }, tx);
  });
  await dropFile(profile.avatarKey);
  return true;
}

/** Biznes egasining (birinchi) biznesi — `ownerProfile` bilan bir xil tanlov. */
const ownedBusiness = (ownerId: string) =>
  db.business.findFirst({ where: { ownerId, owner: { status: "ACTIVE" } }, orderBy: { createdAt: "asc" }, select: { id: true, logoKey: true } });

export async function setBusinessLogo(ownerId: string, bytes: Uint8Array): Promise<ImageResult> {
  const business = await ownedBusiness(ownerId);
  if (!business) return { ok: false, problem: "not_allowed" };
  const result = await clean(ownerId, "business.logo", bytes);
  if (!result.ok) return result;
  const key = `business/${business.id}/logo-${randomUUID()}.${result.file.ext}`;
  await storage().put(key, result.file.bytes);
  try {
    await db.$transaction(async (tx) => {
      await tx.business.update({ where: { id: business.id }, data: { logoKey: key } });
      await audit({ actorId: ownerId, action: "business.logo", entity: "Business", entityId: business.id }, tx);
    });
  } catch (error) {
    await dropFile(key);
    throw error;
  }
  await dropFile(business.logoKey);
  return { ok: true, key };
}

export async function removeBusinessLogo(ownerId: string): Promise<boolean> {
  const business = await ownedBusiness(ownerId);
  if (!business?.logoKey) return false;
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: business.id }, data: { logoKey: null } });
    await audit({ actorId: ownerId, action: "business.logo.remove", entity: "Business", entityId: business.id }, tx);
  });
  await dropFile(business.logoKey);
  return true;
}

const mimeOf = (key: string) => (key.endsWith(".png") ? "image/png" : "image/jpeg");

/** Talaba avatarini faqat o'zi va admin ko'ra oladi. Ruxsat yo'q yoki rasm yo'q — null (bir xil 404). */
export async function readStudentAvatar(userId: string, viewer: { id: string; role: string } | null) {
  if (!viewer || (viewer.id !== userId && viewer.role !== "ADMIN")) return null;
  const profile = await db.studentProfile.findUnique({ where: { userId }, select: { avatarKey: true } });
  if (!profile?.avatarKey) return null;
  const bytes = await storage().get(profile.avatarKey);
  return bytes ? { bytes, mime: mimeOf(profile.avatarKey), public: false } : null;
}

/** Biznes logotipi: tasdiqlangan biznesniki hammaga (talaba lentasi, landing); aks holda faqat egasi va admin. */
export async function readBusinessLogo(businessId: string, viewer: { id: string; role: string } | null) {
  const business = await db.business.findUnique({ where: { id: businessId }, select: { logoKey: true, status: true, ownerId: true, owner: { select: { status: true } } } });
  if (!business?.logoKey) return null;
  const visible = (business.status === "APPROVED" || business.status === "WARNED") && business.owner.status === "ACTIVE";
  const privileged = viewer?.role === "ADMIN" || viewer?.id === business.ownerId;
  if (!visible && !privileged) return null;
  const bytes = await storage().get(business.logoKey);
  return bytes ? { bytes, mime: mimeOf(business.logoKey), public: visible } : null;
}
