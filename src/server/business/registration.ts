import "server-only";
import { randomUUID } from "node:crypto";
import { normalizeTin, PHOTOS_MAX, validateBusiness, type BusinessInfo } from "@/lib/business";
import type { BusinessKind, DocKind } from "@/generated/prisma/client";
import { audit } from "../audit";
import { db } from "../db";
import { isUniqueViolation } from "../db-errors";
import { storage } from "../storage";
import { checkUpload, safeFileName, type UploadProblem } from "../storage/file-rules";
import { sanitizeDocument, UnreadableFileError, type CleanFile } from "../storage/sanitize";

/** Bir egasi bir kunda yuklay oladigan fayllar soni (omborni to'ldirishga qarshi). */
export const DAILY_DOC_LIMIT = 20;
/** Shartlar matni versiyasi — rozilik audit'ga shu bilan yoziladi */
export const PARTNER_TERMS_VERSION = "2026-10";

/** Egasi arizani o'zgartira oladigan holatlar: hali yuborilmagan yoki rad etilgan. */
const EDITABLE = (b: { status: string; submittedAt: Date | null }) => (b.status === "PENDING" && b.submittedAt === null) || b.status === "REJECTED";

export type CleanInfo = {
  name: string;
  kind: BusinessKind;
  address: string;
  workingHours: string;
  description: string | null;
  tin: string;
  contactName: string;
};

/** Tekshiradi va tozalaydi; xato maydonlar bo'lsa — ularning ro'yxati. */
export function cleanBusinessInfo(info: BusinessInfo): { ok: true; info: CleanInfo } | { ok: false; fields: (keyof BusinessInfo)[] } {
  const fields = validateBusiness(info);
  if (fields.length > 0) return { ok: false, fields };
  return {
    ok: true,
    info: {
      name: info.name.trim(),
      kind: info.kind as BusinessKind,
      address: info.address.trim(),
      workingHours: info.workingHours.trim(),
      description: info.description.trim() || null,
      tin: normalizeTin(info.tin)!,
      contactName: info.contactName.trim().replace(/\s+/g, " "),
    },
  };
}

/** Manzilda tuman nomi bo'lsa ("…, Chilonzor") — o'sha tuman. Aniq bo'lmasa admin keyin belgilaydi. */
async function districtFromAddress(address: string): Promise<string | null> {
  const districts = await db.district.findMany({ select: { id: true, name: true } });
  const lower = address.toLocaleLowerCase("uz");
  const found = districts.filter((d) => lower.includes(d.name.toLocaleLowerCase("uz")));
  return found.length === 1 ? found[0].id : null;
}

const tinTaken = (error: unknown) => isUniqueViolation(error, "tin");

const splitName = (full: string) => {
  const [firstName, ...rest] = full.split(" ");
  return { firstName, lastName: rest.join(" ") || null };
};

/**
 * Tasdiqlangan raqam uchun biznes egasi hisobi va arizasi (hali yuborilmagan: hujjatlar keyin yuklanadi).
 * STIR band bo'lsa — xato (bitta biznes faqat bir marta ro'yxatdan o'tadi).
 */
export async function createBusinessOwner(phone: string, info: CleanInfo): Promise<{ ok: true; userId: string } | { ok: false; error: "tinTaken" }> {
  const districtId = await districtFromAddress(info.address);
  try {
    const user = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { phone, role: "BUSINESS_OWNER", ...splitName(info.contactName) }, select: { id: true } });
      await tx.business.create({
        data: { ...info, ownerId: user.id, districtId, contactPhone: phone, members: { create: { userId: user.id, role: "OWNER" } } },
      });
      return user;
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    if (tinTaken(error)) return { ok: false, error: "tinTaken" };
    throw error;
  }
}

/** Egasining biznesi (bitta egasi — bitta biznes). */
export function ownBusiness(ownerId: string) {
  return db.business.findFirst({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      address: true,
      workingHours: true,
      description: true,
      tin: true,
      contactName: true,
      contactPhone: true,
      status: true,
      rejectReason: true,
      submittedAt: true,
      logoKey: true,
      docs: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, fileName: true } },
    },
  });
}
export type OwnBusiness = NonNullable<Awaited<ReturnType<typeof ownBusiness>>>;

/** Yuborilmagan yoki rad etilgan arizaning ma'lumotlarini yangilash. */
export async function updateBusinessInfo(ownerId: string, info: CleanInfo): Promise<{ ok: true } | { ok: false; error: "notEditable" | "tinTaken" }> {
  const business = await ownBusiness(ownerId);
  if (!business || !EDITABLE(business)) return { ok: false, error: "notEditable" };
  try {
    await db.business.update({
      where: { id: business.id },
      data: { ...info, districtId: await districtFromAddress(info.address) },
    });
    await db.user.update({ where: { id: ownerId }, data: splitName(info.contactName) });
    return { ok: true };
  } catch (error) {
    if (tinTaken(error)) return { ok: false, error: "tinTaken" };
    throw error;
  }
}

export type DocUploadKind = "registration" | "photo" | "logo";
export type DocProblem = UploadProblem | "not_allowed" | "daily_limit" | "too_many";
export type DocResult = { ok: true; id: string } | { ok: false; problem: DocProblem };

/**
 * Biznes hujjati yoki logotipi: mazmuni tekshiriladi, metama'lumotlar tozalanadi (rasm qayta kodlanadi — EXIF/GPS
 * qolmaydi), private omborga yoziladi. Ro'yxatdan o'tganlik guvohnomasi — bitta (yangisi eskisini almashtiradi),
 * joy fotolari — 3 tagacha, logotip — faqat rasm.
 */
export async function uploadBusinessDoc(ownerId: string, kind: DocUploadKind, bytes: Uint8Array, originalName: string): Promise<DocResult> {
  const business = await ownBusiness(ownerId);
  if (!business || !EDITABLE(business)) return { ok: false, problem: "not_allowed" };

  const checked = checkUpload(bytes);
  if (!checked.ok) return checked;
  if (kind !== "registration" && checked.type.ext === "pdf") return { ok: false, problem: "bad_type" };
  if (kind === "photo" && business.docs.filter((d) => d.kind === "PHOTO").length >= PHOTOS_MAX) return { ok: false, problem: "too_many" };

  const recent = await db.auditLog.count({
    where: { actorId: ownerId, action: "business.upload", createdAt: { gt: new Date(Date.now() - 86_400_000) } },
  });
  if (recent >= DAILY_DOC_LIMIT) return { ok: false, problem: "daily_limit" };

  let clean: CleanFile;
  try {
    clean = await sanitizeDocument(bytes, checked.type);
  } catch (error) {
    if (error instanceof UnreadableFileError) return { ok: false, problem: "bad_type" };
    throw error;
  }

  // Kalit faqat o'zimiz yaratgan qismlardan: foydalanuvchi bergan nom yo'lga kirmaydi.
  const fileKey = `business/${business.id}/${kind}-${randomUUID()}.${clean.ext}`;
  await storage().put(fileKey, clean.bytes);

  try {
    const { id, oldKeys } = await db.$transaction(async (tx) => {
      await audit({ actorId: ownerId, action: "business.upload", entity: "Business", entityId: business.id, meta: { kind } }, tx);
      if (kind === "logo") {
        await tx.business.update({ where: { id: business.id }, data: { logoKey: fileKey } });
        return { id: business.id, oldKeys: business.logoKey ? [business.logoKey] : [] };
      }
      const docKind: DocKind = kind === "registration" ? "REGISTRATION" : "PHOTO";
      const replaced = kind === "registration" ? await tx.businessDoc.findMany({ where: { businessId: business.id, kind: "REGISTRATION" } }) : [];
      await tx.businessDoc.deleteMany({ where: { id: { in: replaced.map((d) => d.id) } } });
      const doc = await tx.businessDoc.create({
        data: { businessId: business.id, kind: docKind, fileKey, fileName: safeFileName(originalName, `${kind}.${clean.ext}`) },
        select: { id: true },
      });
      return { id: doc.id, oldKeys: replaced.map((d) => d.fileKey) };
    });
    // Eski fayllar tranzaksiya muvaffaqiyatli tugagandan keyingina o'chiriladi.
    await Promise.all(oldKeys.map((key) => storage().delete(key).catch(() => undefined)));
    return { ok: true, id };
  } catch (error) {
    await storage().delete(fileKey).catch(() => undefined);
    throw error;
  }
}

/** Yuborilmagan/rad etilgan arizadan faylni olib tashlash (faqat o'z biznesidan). */
export async function removeBusinessDoc(ownerId: string, docId: string): Promise<boolean> {
  const business = await ownBusiness(ownerId);
  if (!business || !EDITABLE(business)) return false;
  const doc = await db.businessDoc.findFirst({ where: { id: docId, businessId: business.id }, select: { id: true, fileKey: true } });
  if (!doc) return false;
  await db.businessDoc.delete({ where: { id: doc.id } });
  await storage().delete(doc.fileKey).catch(() => undefined);
  return true;
}

export type SubmitProblem = "notEditable" | "noRegistration" | "noPhotos" | "consent";

/** Arizani tekshiruvga yuborish: guvohnoma va kamida bitta joy fotosi bo'lishi, shartlarga rozilik shart. */
export async function submitBusiness(ownerId: string, consent: boolean): Promise<{ ok: true } | { ok: false; problem: SubmitProblem }> {
  if (!consent) return { ok: false, problem: "consent" };
  const business = await ownBusiness(ownerId);
  if (!business || !EDITABLE(business)) return { ok: false, problem: "notEditable" };
  if (!business.docs.some((d) => d.kind === "REGISTRATION")) return { ok: false, problem: "noRegistration" };
  if (!business.docs.some((d) => d.kind === "PHOTO")) return { ok: false, problem: "noPhotos" };

  return db.$transaction(async (tx) => {
    const updated = await tx.business.updateMany({
      where: { id: business.id, status: business.status },
      data: { status: "PENDING", submittedAt: new Date(), rejectReason: null },
    });
    if (updated.count === 0) return { ok: false as const, problem: "notEditable" as const };
    await audit(
      { actorId: ownerId, action: "business.submit", entity: "Business", entityId: business.id, meta: { terms: PARTNER_TERMS_VERSION } },
      tx,
    );
    return { ok: true as const };
  });
}
