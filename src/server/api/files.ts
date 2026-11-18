import "server-only";
import { db } from "../db";
import { authSecret } from "../env";
import { receipt, receiptPdfUz } from "../coupons/receipts";
import { REPORT_MIME, statsReport } from "../business/report";
import { storage } from "../storage";
import { checkFileSignature, fileExpiry, fileSignature } from "./rules";

/*
 * Ilova uchun fayllar (rasmlar va chek PDF'i): sayt manzillari cookie bilan ishlaydi, ilovada cookie yo'q. API javobida
 * har bir fayl manzili qisqa muddatli imzoli havolaga almashtiriladi (`/api/v1/files/<tur>/<id>?exp=&sig=`) — imzo faqat
 * ko'rishga ruxsati bor foydalanuvchiga berilgan javobda chiqadi, ya'ni havolaning o'zi ruxsat. `<Image>` ga sarlavha
 * qo'shish shart emas, ilova keshi ishlaydi (manzil bir soat ichida o'zgarmaydi), havola 1–2 soatda eskiradi.
 */

export const FILE_KINDS = ["discount-image", "logo", "avatar", "receipt", "report"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export function signedFileUrl(kind: FileKind, id: string, version?: string | null, now = Date.now()): string {
  const exp = fileExpiry(now);
  const sig = fileSignature(kind, id, exp, authSecret());
  return `/api/v1/files/${kind}/${id}?exp=${exp}&sig=${sig}${version ? `&v=${encodeURIComponent(version)}` : ""}`;
}

/** Sayt manzillari (cookie bilan ishlaydiganlari) → imzoli ilova havolasi */
const SITE_URLS: [RegExp, FileKind][] = [
  [/^\/api\/chegirma\/rasm\/([a-z0-9]{10,40})$/, "discount-image"],
  [/^\/api\/biznes\/logo\/([a-z0-9]{10,40})(?:\?v=([\w-]{1,20}))?$/, "logo"],
  [/^\/api\/avatar\/([a-z0-9]{10,40})(?:\?v=([\w-]{1,20}))?$/, "avatar"],
];

export function signSiteUrl(url: string, now = Date.now()): string {
  for (const [re, kind] of SITE_URLS) {
    const m = re.exec(url);
    if (m) return signedFileUrl(kind, m[1]!, m[2], now);
  }
  return url;
}

/**
 * Javobdagi barcha sayt fayl manzillarini (`images`, `logoUrl`, … qayerda bo'lsa ham) imzoli havolaga almashtiradi.
 * Javob ruxsat tekshiruvidan keyin quriladi — imzo faqat ko'ra oladiganga beriladi.
 */
export function signUrls<T>(value: T, now = Date.now()): T {
  if (typeof value === "string") return signSiteUrl(value, now) as T;
  if (Array.isArray(value)) return value.map((v) => signUrls(v, now)) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, signUrls(v, now)])) as T;
  }
  return value;
}

export const isFileKind = (kind: string): kind is FileKind => (FILE_KINDS as readonly string[]).includes(kind);

export const fileSignatureOk = (kind: FileKind, id: string, exp: number, sig: string, now = Date.now()) => checkFileSignature(kind, id, exp, sig, authSecret(), now);

const mimeOf = (key: string) => (key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg");

/** Imzo tekshirilgandan keyin: fayl baytlari. Yo'q bo'lsa (o'chirilgan) — null. */
export async function readSignedFile(kind: FileKind, id: string): Promise<{ bytes: Uint8Array; mime: string; name?: string } | null> {
  if (kind === "report") {
    // id = `<biznesId>_<davr>` — havola faqat egasiga statistika javobida beriladi
    const [businessId, period] = id.split("_");
    if (!businessId || !["1", "7", "30"].includes(period ?? "")) return null;
    const business = await db.business.findUnique({ where: { id: businessId }, select: { id: true, name: true } });
    if (!business) return null;
    const report = await statsReport(business, Number(period) as 1 | 7 | 30);
    return { bytes: report.bytes, mime: REPORT_MIME, name: report.name };
  }
  if (kind === "receipt") {
    const found = await receipt(id);
    return found ? { bytes: await receiptPdfUz(found.data), mime: "application/pdf", name: `chek-${found.data.no}.pdf` } : null;
  }
  const key =
    kind === "discount-image"
      ? (await db.discountImage.findUnique({ where: { id }, select: { fileKey: true } }))?.fileKey
      : kind === "logo"
        ? (await db.business.findUnique({ where: { id }, select: { logoKey: true } }))?.logoKey
        : (await db.studentProfile.findUnique({ where: { userId: id }, select: { avatarKey: true } }))?.avatarKey;
  if (!key) return null;
  const bytes = await storage().get(key);
  return bytes ? { bytes, mime: mimeOf(key) } : null;
}
