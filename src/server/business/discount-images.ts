import "server-only";
import { randomUUID } from "node:crypto";
import { audit } from "../audit";
import { db } from "../db";
import { storage } from "../storage";
import { checkUpload } from "../storage/file-rules";
import { sanitizeDocument, UnreadableFileError, type CleanFile } from "../storage/sanitize";
import { discountImageUrl } from "@/lib/feed";
import { visibleDiscountWhere } from "../student/feed";

/** Chegirma rasmlari: 1–4 ta (ixtiyoriy), faqat rasm, mavjud tozalash pipeline'idan (EXIF/GPS yo'q, 2560px gacha). */
export const DISCOUNT_IMAGES_MAX = 4;
const DAILY_IMAGE_LIMIT = 40;

export type ImageProblem = "empty" | "too_large" | "bad_type" | "not_allowed" | "too_many" | "daily_limit";
export type ImageResult = { ok: true; id: string } | { ok: false; problem: ImageProblem };


/** Rasm o'zgarsa — mazmun o'zgargan: tasdiqlangan chegirma yana admin tekshiruviga tushadi. */
async function reReview(ownerId: string, discountId: string, status: string, tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  if (status !== "ACTIVE" && status !== "PAUSED") return;
  const updated = await tx.discount.updateMany({ where: { id: discountId, status }, data: { status: "PENDING_REVIEW", rejectReason: null } });
  if (updated.count) await audit({ actorId: ownerId, action: "discount.submit", entity: "Discount", entityId: discountId, meta: { from: status, images: true } }, tx);
}

async function ownEditable(ownerId: string, discountId: string) {
  return db.discount.findFirst({
    where: {
      id: discountId,
      status: { in: ["DRAFT", "PENDING_REVIEW", "REJECTED", "ACTIVE", "PAUSED"] },
      business: { ownerId, status: { in: ["PENDING", "APPROVED", "WARNED"] } },
    },
    select: { id: true, status: true, images: { select: { id: true, sort: true } } },
  });
}

export async function uploadDiscountImage(ownerId: string, discountId: string, bytes: Uint8Array): Promise<ImageResult> {
  const discount = await ownEditable(ownerId, discountId);
  if (!discount) return { ok: false, problem: "not_allowed" };
  if (discount.images.length >= DISCOUNT_IMAGES_MAX) return { ok: false, problem: "too_many" };

  const checked = checkUpload(bytes);
  if (!checked.ok) return checked;
  if (checked.type.ext === "pdf") return { ok: false, problem: "bad_type" };

  const recent = await db.auditLog.count({ where: { actorId: ownerId, action: "discount.image", createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (recent >= DAILY_IMAGE_LIMIT) return { ok: false, problem: "daily_limit" };

  let clean: CleanFile;
  try {
    clean = await sanitizeDocument(bytes, checked.type);
  } catch (error) {
    if (error instanceof UnreadableFileError) return { ok: false, problem: "bad_type" };
    throw error;
  }

  const fileKey = `discounts/${discount.id}/${randomUUID()}.${clean.ext}`;
  await storage().put(fileKey, clean.bytes);
  try {
    const id = await db.$transaction(async (tx) => {
      // Parallel yuklashlarda ham 4 tadan oshmasin
      const count = await tx.discountImage.count({ where: { discountId: discount.id } });
      if (count >= DISCOUNT_IMAGES_MAX) return null;
      const sort = Math.max(-1, ...discount.images.map((i) => i.sort)) + 1;
      const image = await tx.discountImage.create({ data: { discountId: discount.id, fileKey, sort }, select: { id: true } });
      await audit({ actorId: ownerId, action: "discount.image", entity: "Discount", entityId: discount.id }, tx);
      await reReview(ownerId, discount.id, discount.status, tx);
      return image.id;
    });
    if (!id) {
      await storage().delete(fileKey).catch(() => undefined);
      return { ok: false, problem: "too_many" };
    }
    return { ok: true, id };
  } catch (error) {
    await storage().delete(fileKey).catch(() => undefined);
    throw error;
  }
}

export async function removeDiscountImage(ownerId: string, imageId: string): Promise<boolean> {
  const image = await db.discountImage.findFirst({
    where: { id: imageId, discount: { business: { ownerId } } },
    select: { id: true, fileKey: true, discountId: true, discount: { select: { status: true } } },
  });
  if (!image || !(await ownEditable(ownerId, image.discountId))) return false;
  await db.$transaction(async (tx) => {
    await tx.discountImage.delete({ where: { id: image.id } });
    await reReview(ownerId, image.discountId, image.discount.status, tx);
  });
  await storage().delete(image.fileKey).catch(() => undefined);
  return true;
}

export async function discountImages(discountId: string): Promise<{ id: string; url: string }[]> {
  const images = await db.discountImage.findMany({ where: { discountId }, orderBy: { sort: "asc" }, select: { id: true } });
  return images.map((i) => ({ id: i.id, url: discountImageUrl(i.id) }));
}

/**
 * Rasmni kim ko'ra oladi: talabaga ko'rinadigan chegirmaniki — hamma (landing kartalari ham; shaxsiy ma'lumot emas);
 * aks holda faqat biznes egasi va admin. Ruxsat yo'q — null (fayl borligi oshkor qilinmaydi).
 */
export async function readDiscountImage(imageId: string, viewer: { id: string; role: string } | null) {
  const image = await db.discountImage.findUnique({
    where: { id: imageId },
    select: { fileKey: true, discountId: true, discount: { select: { business: { select: { ownerId: true } } } } },
  });
  if (!image) return null;
  const visible = (await db.discount.count({ where: { AND: [{ id: image.discountId }, visibleDiscountWhere(new Date())] } })) > 0;
  const privileged = viewer?.role === "ADMIN" || viewer?.id === image.discount.business.ownerId;
  if (!visible && !privileged) return null;
  const bytes = await storage().get(image.fileKey);
  if (!bytes) return null;
  return { bytes, mime: image.fileKey.endsWith(".png") ? "image/png" : "image/jpeg", public: visible };
}
