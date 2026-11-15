import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import type { LocalFile } from "@/api/endpoints";

/** Server chegarasi bilan bir xil (`MAX_UPLOAD_BYTES`) */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export class FileTooLargeError extends Error {}

/** Hujjat (PDF yoki rasm). Bekor qilinsa — null. */
export async function pickDocument(): Promise<LocalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/heic"], copyToCacheDirectory: true });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if (asset.size && asset.size > MAX_FILE_BYTES) throw new FileTooLargeError();
  return { uri: asset.uri, name: asset.name || "hujjat", type: asset.mimeType ?? "application/octet-stream" };
}

/** Galereyadan rasm (JPEG ga siqiladi — HEIC ham). Bekor qilinsa — null. */
export async function pickImage(name: string): Promise<LocalFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) throw new FileTooLargeError();
  return { uri: asset.uri, name: asset.fileName || name, type: asset.mimeType ?? "image/jpeg" };
}
