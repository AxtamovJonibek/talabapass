/** Yuklanadigan hujjat fayllari qoidalari — sof funksiyalar (test bilan). */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type AllowedType = { mime: "image/jpeg" | "image/png" | "application/pdf"; ext: "jpg" | "png" | "pdf" };

/**
 * Fayl turini mazmunidan (boshidagi baytlardan) aniqlaydi. Mijoz yuborgan nom yoki Content-Type ga ishonilmaydi:
 * "guvohnoma.jpg" deb nomlangan HTML yoki skript shu yerda rad etiladi.
 */
export function sniffType(bytes: Uint8Array): AllowedType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return { mime: "application/pdf", ext: "pdf" }; // %PDF-
  return null;
}

export type UploadProblem = "empty" | "too_large" | "bad_type";

export function checkUpload(bytes: Uint8Array): { ok: true; type: AllowedType } | { ok: false; problem: UploadProblem } {
  if (bytes.byteLength === 0) return { ok: false, problem: "empty" };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, problem: "too_large" };
  const type = sniffType(bytes);
  return type ? { ok: true, type } : { ok: false, problem: "bad_type" };
}

/** Ko'rsatish uchun saqlanadigan asl fayl nomi: yo'l va boshqaruv belgilarisiz, 120 belgigacha. */
export function safeFileName(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim().slice(0, 120);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}

/** Saqlash kaliti faqat biz yaratgan qismlardan tuziladi; baribir tekshiriladi (kataloglardan chiqib ketmasligi uchun). */
export function isSafeKey(key: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(key) && !key.includes("..");
}

/** 1 843 200 → "1.8 MB" (T3, WT1 dagi ko'rinish) */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
