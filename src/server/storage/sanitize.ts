import "server-only";
import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import sharp from "sharp";
import type { AllowedType } from "./file-rules";

/**
 * Yuklangan hujjatni saqlashdan oldin tozalash.
 *
 * Rasmlar (JPG, PNG, HEIC) noldan qayta kodlanadi: EXIF (GPS joylashuvi, qurilma, sana), XMP, IPTC va boshqa
 * metama'lumotlar to'liq tushib qoladi; yo'nalish (orientation) piksellarga qo'llanadi. HEIC — JPEG ga aylanadi.
 * Juda katta o'lchamli rasm 2560px gacha kichraytiriladi (moderatsiya uchun yetarli, omborni tejaydi).
 *
 * PDF: hujjat ma'lumotlari (muallif, dastur, sana) va XMP olib tashlanadi. PDF ichidagi rasmlarning
 * o'z EXIF'i qayta kodlanmaydi — bu cheklov CLAUDE.md da qayd etilgan.
 */
export type CleanFile = { bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "application/pdf"; ext: "jpg" | "png" | "pdf" };

export class UnreadableFileError extends Error {}

const MAX_SIDE = 2560;
/** Siqilgan holda kichik, ochilganda ulkan rasm ("decompression bomb") — 50 megapikseldan katta bo'lsa rad etiladi */
const MAX_INPUT_PIXELS = 50_000_000;

async function reencode(input: Uint8Array, as: "jpeg" | "png"): Promise<Uint8Array> {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
    // sharp chiqishiga metama'lumot faqat withMetadata/withExif so'ralsa yoziladi — bu yerda so'ralmaydi.
    const output = as === "jpeg" ? image.jpeg({ quality: 88, mozjpeg: true }) : image.png({ compressionLevel: 9 });
    return new Uint8Array(await output.toBuffer());
  } catch (error) {
    throw new UnreadableFileError(`Rasmni o'qib bo'lmadi: ${(error as Error).message}`);
  }
}

async function heicToJpeg(input: Uint8Array): Promise<Uint8Array> {
  try {
    // HEVC kodeki patent sabab sharp'da yo'q — libheif (wasm) orqali.
    const { default: convert } = await import("heic-convert");
    return new Uint8Array(await convert({ buffer: input, format: "JPEG", quality: 0.95 }));
  } catch (error) {
    throw new UnreadableFileError(`HEIC faylni o'qib bo'lmadi: ${(error as Error).message}`);
  }
}

async function scrubPdf(input: Uint8Array): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.load(input, { updateMetadata: false });
    // Hujjat ma'lumotlari lug'ati (muallif, dastur, sanalar) va XMP: havolani uzishning o'zi yetmaydi —
    // pdf-lib havola qilinmagan obyektni ham faylga yozadi, shuning uchun obyektlarning o'zi o'chiriladi.
    const info = pdf.context.trailerInfo.Info;
    if (info instanceof PDFRef) pdf.context.delete(info);
    pdf.context.trailerInfo.Info = undefined;
    const xmp = pdf.catalog.get(PDFName.of("Metadata"));
    if (xmp instanceof PDFRef) pdf.context.delete(xmp);
    pdf.catalog.delete(PDFName.of("Metadata"));
    // Obyekt oqimlarisiz saqlanadi: natija tekshiriladigan (siqilmagan) bo'lib qoladi.
    return new Uint8Array(await pdf.save({ useObjectStreams: false, updateFieldAppearances: false }));
  } catch (error) {
    throw new UnreadableFileError(`PDF ni o'qib bo'lmadi (shifrlangan yoki buzilgan): ${(error as Error).message}`);
  }
}

export async function sanitizeDocument(input: Uint8Array, type: AllowedType): Promise<CleanFile> {
  switch (type.ext) {
    case "jpg":
      return { bytes: await reencode(input, "jpeg"), mime: "image/jpeg", ext: "jpg" };
    case "png":
      return { bytes: await reencode(input, "png"), mime: "image/png", ext: "png" };
    case "heic":
      return { bytes: await reencode(await heicToJpeg(input), "jpeg"), mime: "image/jpeg", ext: "jpg" };
    case "pdf":
      return { bytes: await scrubPdf(input), mime: "application/pdf", ext: "pdf" };
  }
}
