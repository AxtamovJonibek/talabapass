import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import type { LocalFile } from "@/api/endpoints";

/** Yuklashdan oldin: uzun tomon 2000px gacha, JPEG 0.8 (zamonaviy kamera rasmi 5–15 MB → ~0.5–1 MB). */
export const MAX_IMAGE_SIDE = 2000;
export const JPEG_QUALITY = 0.8;

/**
 * Rasmni siqadi (JPG/PNG/HEIC → JPEG). PDF va boshqa fayllar o'zgarmaydi. Web (dizayn ko'rinishi) — o'zgarmaydi.
 * Dekodlash 2× chegara bilan (50 Mpx rasm xotirani to'ldirmasin), keyin aniq o'lchamga.
 */
export async function compressImage(file: LocalFile): Promise<LocalFile> {
  if (Platform.OS === "web" || !file.type.startsWith("image/")) return file;
  const loaded = await ImageManipulator.manipulate(file.uri, { maxWidth: MAX_IMAGE_SIDE * 2, maxHeight: MAX_IMAGE_SIDE * 2 }).renderAsync();
  const long = Math.max(loaded.width, loaded.height);
  const image =
    long > MAX_IMAGE_SIDE
      ? await ImageManipulator.manipulate(loaded)
          .resize(loaded.width >= loaded.height ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE })
          .renderAsync()
      : loaded;
  const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  console.log(`[upload] siqildi: ${loaded.width}×${loaded.height} → ${saved.width}×${saved.height}`);
  return { uri: saved.uri, name: file.name.replace(/\.[^.]*$/, "") + ".jpg", type: "image/jpeg" };
}
