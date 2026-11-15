import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import type { LocalFile } from "@/api/endpoints";

/** Server chegarasi bilan bir xil (`MAX_UPLOAD_BYTES`) */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export class FileTooLargeError extends Error {}

/**
 * Hujjat (PDF yoki rasm). Bekor qilinsa — null. Hajm bu yerda faqat PDF uchun tekshiriladi: rasm yuborishdan oldin
 * siqiladi (`compressImage`) va hajmi o'shanda tekshiriladi.
 */
export async function pickDocument(): Promise<LocalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/heic"], copyToCacheDirectory: true });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const type = asset.mimeType ?? "application/octet-stream";
  if (!type.startsWith("image/") && asset.size && asset.size > MAX_FILE_BYTES) throw new FileTooLargeError();
  return { uri: asset.uri, name: asset.name || "hujjat", type };
}

/** Galereyadan rasm (yuborishdan oldin siqiladi — HEIC ham JPEG bo'ladi). Bekor qilinsa — null. */
export async function pickImage(name: string): Promise<LocalFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.fileName || name, type: asset.mimeType ?? "image/jpeg" };
}
