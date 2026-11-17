import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
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

/** Profil rasmi va logotip tomoni (saytdagi `AVATAR_SIZE`): server ham shu o'lchamni kutadi */
export const AVATAR_SIZE = 512;

/**
 * Profil rasmi / logotip: galereya yoki kamera, tizimning kesish oynasi (kvadrat), keyin 512×512 JPEG.
 * Bekor qilinsa — null. Kamera ruxsati berilmasa — `denied`.
 */
export async function pickSquarePhoto(source: "library" | "camera", name: string): Promise<LocalFile | null | "denied"> {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return "denied";
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  // Kesish oynasi kvadrat beradi; baribir markazdan kvadrat qilib (ba'zi qurilmalar 1–2px farq qiladi) 512 ga keltiramiz
  const side = Math.min(asset.width, asset.height);
  const image = await ImageManipulator.manipulate(asset.uri)
    .crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side })
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  return { uri: saved.uri, name: `${name}.jpg`, type: "image/jpeg" };
}
